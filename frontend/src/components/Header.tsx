interface HeaderProps {
  title?: string;
  onBack?: () => void;
}

export default function Header({ title, onBack }: HeaderProps) {
  return (
    <header className="bg-tcb-blue text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-10 shadow-md">
      {onBack && (
        <button onClick={onBack} className="text-white text-xl font-bold px-1 active:opacity-70">
          ←
        </button>
      )}
      <div className="flex items-center gap-2 flex-1">
        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
          <span className="text-tcb-blue font-black text-xs">合庫</span>
        </div>
        <div>
          <p className="text-xs opacity-75">合作金庫銀行</p>
          <p className="font-bold text-sm leading-tight">{title || '個金Co-Pilot領航員'}</p>
        </div>
      </div>
    </header>
  );
}
