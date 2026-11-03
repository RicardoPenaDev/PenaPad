import { Feather } from 'lucide-react';
import { t } from '../i18n';

export default function TitleBar({ title, dirty }: { title: string; dirty: boolean }) {
  return (
    <div data-tauri-drag-region className="relative flex h-[40px] shrink-0 items-center bg-[var(--chrome)] pl-[92px]">
      <div className="pointer-events-none flex items-center gap-2">
        <div className="flex h-[20px] w-[20px] items-center justify-center rounded-[5px] bg-gradient-to-br from-[#3a73d8] to-[#173c80] text-white shadow-sm">
          <Feather size={12} strokeWidth={2.4} />
        </div>
        <span className="text-[12.5px] font-semibold text-[var(--text-2)]">PenaPad</span>
      </div>
      <div className="pointer-events-none absolute inset-x-0 flex justify-center">
        <span className="max-w-[50%] truncate text-[13px] font-semibold">
          {title}
          {dirty && <span className="ml-1.5 font-normal text-[var(--text-3)]">— {t('Editado')}</span>}
        </span>
      </div>
    </div>
  );
}
