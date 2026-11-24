#import <Foundation/Foundation.h>
#import <AVFoundation/AVFoundation.h>
#import <Speech/Speech.h>

// Everything except the audio tap runs on the main queue. No audio is saved to disk.
typedef void (*PPCallback)(uint32_t, const char *, const char *);
@interface PPDictation : NSObject
@property uint32_t token;
@property PPCallback callback;
@property(nonatomic, strong) AVAudioEngine *engine;
@property(nonatomic, strong) SFSpeechRecognizer *recognizer;
@property(nonatomic, strong) SFSpeechAudioBufferRecognitionRequest *request;
@property(nonatomic, strong) SFSpeechRecognitionTask *task;
@property BOOL tapped;
@property BOOL stopping;
- (void)send:(NSString *)kind text:(NSString *)text;
- (void)finish:(NSString *)error;
- (void)record:(NSString *)locale;
- (void)stop;
@end

static PPDictation *current;

static NSString *speechError(NSError *error) {
    NSError *cause = error;
    for (int depth = 0; cause && depth < 8; depth++) {
        if (([cause.domain isEqualToString:@"kLSRErrorDomain"] && cause.code == 201) ||
            [cause.localizedDescription containsString:@"Siri and Dictation are disabled"]) {
            return @"speech-disabled";
        }
        cause = cause.userInfo[NSUnderlyingErrorKey];
    }
    return [NSString stringWithFormat:@"recognition|%@: %ld", error.domain, (long)error.code];
}
@implementation PPDictation
- (void)send:(NSString *)kind text:(NSString *)text {
    self.callback(self.token, kind.UTF8String, (text ?: @"").UTF8String);
}
- (void)releaseAudio {
    [self.engine stop];
    if (self.tapped) {
        [self.engine.inputNode removeTapOnBus:0];
        self.tapped = NO;
    }
    [self.request endAudio];
}
- (void)finish:(NSString *)error {
    if (current != self) return;
    PPDictation *keepAlive = self;
    [self releaseAudio];
    current = nil; // Ignore cancellation callbacks from the old task.
    [self.task cancel];
    self.task = nil;
    self.engine = nil;
    self.request = nil;
    if (error) [keepAlive send:@"error" text:error];
    [keepAlive send:@"stopped" text:@""];
}
- (void)stop {
    if (current != self || self.stopping) return;
    self.stopping = YES;
    if (!self.task) { [self finish:nil]; return; } // Cancel during permission dialogs.
    [self releaseAudio];
    // Keep accepting the final transcription, but never hold the microphone while waiting.
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 5 * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
        if (current == self) [self finish:nil];
    });
}
- (void)record:(NSString *)locale {
    if (current != self) return;
    self.recognizer = [[SFSpeechRecognizer alloc] initWithLocale:[NSLocale localeWithLocaleIdentifier:locale]];
    if (!self.recognizer || !self.recognizer.available) { [self finish:@"unavailable"]; return; }
    self.request = [SFSpeechAudioBufferRecognitionRequest new];
    self.request.shouldReportPartialResults = YES;
    if (self.recognizer.supportsOnDeviceRecognition) self.request.requiresOnDeviceRecognition = YES;
    self.engine = [AVAudioEngine new];
    AVAudioInputNode *input = self.engine.inputNode;
    AVAudioFormat *format = [input outputFormatForBus:0];
    if (format.sampleRate <= 0 || format.channelCount == 0) { [self finish:@"microphone"]; return; }
    SFSpeechAudioBufferRecognitionRequest *request = self.request;
    @try {
        [input installTapOnBus:0 bufferSize:1024 format:format block:^(AVAudioPCMBuffer *buffer, AVAudioTime *when) {
            [request appendAudioPCMBuffer:buffer];
        }];
        self.tapped = YES;
        self.task = [self.recognizer recognitionTaskWithRequest:request resultHandler:^(SFSpeechRecognitionResult *result, NSError *error) {
            dispatch_async(dispatch_get_main_queue(), ^{
                if (current != self) return;
                if (result) [self send:@"transcript" text:result.bestTranscription.formattedString];
                if (result.isFinal) [self finish:nil];
                else if (error) [self finish:self.stopping ? nil : speechError(error)];
            });
        }];
        [self.engine prepare];
        NSError *error = nil;
        if (![self.engine startAndReturnError:&error]) { [self finish:@"microphone"]; return; }
        [self send:@"listening" text:@""];
        // Speech tasks are short sessions; let the user review before starting another one.
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 55 * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
            if (current == self) { [self send:@"stopping" text:@""]; [self stop]; }
        });
    } @catch (NSException *exception) {
        [self finish:@"microphone"];
    }
}
@end

void pp_dictation_start(uint32_t token, const char *language, PPCallback callback) {
    NSString *locale = [NSString stringWithUTF8String:language];
    dispatch_async(dispatch_get_main_queue(), ^{
        if (current) [current finish:nil];
        PPDictation *session = [PPDictation new];
        session.token = token;
        session.callback = callback;
        current = session;
        [SFSpeechRecognizer requestAuthorization:^(SFSpeechRecognizerAuthorizationStatus status) {
            dispatch_async(dispatch_get_main_queue(), ^{
                if (current != session) return;
                if (status != SFSpeechRecognizerAuthorizationStatusAuthorized) { [session finish:@"speech-permission"]; return; }
                [AVCaptureDevice requestAccessForMediaType:AVMediaTypeAudio completionHandler:^(BOOL allowed) {
                    dispatch_async(dispatch_get_main_queue(), ^{
                        if (current != session) return;
                        if (!allowed) { [session finish:@"mic-permission"]; return; }
                        [session record:locale];
                    });
                }];
            });
        }];
    });
}

void pp_dictation_stop(uint32_t token, bool cancel) {
    dispatch_async(dispatch_get_main_queue(), ^{
        if (current.token != token) return;
        if (cancel) [current finish:nil];
        else [current stop];
    });
}
