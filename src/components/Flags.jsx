export function Flag({ lang, className = '' }) {
  return (
    <span className={`inline-flex shrink-0 overflow-hidden rounded-[3px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] ${className}`} aria-hidden="true">
      <svg viewBox="0 0 30 20" className="block h-full w-full" aria-hidden="true">
        {lang === 'th' && (
          <>
            <rect width="30" height="20" fill="#A51931" />
            <rect y="3.33" width="30" height="13.34" fill="#F4F5F8" />
            <rect y="6.67" width="30" height="6.66" fill="#2D2A4A" />
          </>
        )}
        {lang === 'en' && (
          <>
            <rect width="30" height="20" fill="#B22234" />
            {[1.54, 4.62, 7.69, 10.77, 13.85, 16.92].map((y) => <rect key={y} y={y} width="30" height="1.54" fill="#fff" />)}
            <rect width="12" height="10.77" fill="#3C3B6E" />
            {[1.8, 5, 8.2].map((y) => [2, 4.2, 6.4, 8.6, 10.8].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r=".55" fill="#fff" />))}
            {[3.4, 6.6].map((y) => [3.1, 5.3, 7.5, 9.7].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r=".55" fill="#fff" />))}
          </>
        )}
        {lang === 'zh' && (
          <>
            <rect width="30" height="20" fill="#DE2910" />
            <circle cx="6" cy="6" r="3" fill="#FFDE00" />
            {[[11, 2.5], [13, 4.5], [13, 7.5], [11, 9.5]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1" fill="#FFDE00" />)}
          </>
        )}
      </svg>
    </span>
  );
}
