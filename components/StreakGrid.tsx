type Day = { date: string; score: number | null; completed: number; planned: number };

export default function StreakGrid({ days, currentStreak, longestStreak }: { days: Day[]; currentStreak: number; longestStreak: number }) {
  const activity = new Map(days.map((day) => [day.date, day]));
  const last = new Date(`${days.at(-1)?.date ?? new Date().toISOString().slice(0, 10)}T12:00:00`);
  const grid: { key: string; day?: Day }[][] = [];
  const start = new Date(last); start.setDate(last.getDate() - 83);
  for (let week = 0; week < 12; week++) {
    const column = [];
    for (let weekday = 0; weekday < 7; weekday++) {
      const date = new Date(start); date.setDate(start.getDate() + week * 7 + weekday);
      const key = date.toISOString().slice(0, 10);
      column.push({ key, day: activity.get(key) });
    }
    grid.push(column);
  }
  const tone = (day?: Day) => {
    if (!day) return "heat-0";
    const ratio = day.planned ? day.completed / day.planned : 0;
    const value = day.score === null ? ratio * 100 : day.score;
    return value >= 85 ? "heat-4" : value >= 65 ? "heat-3" : value >= 35 ? "heat-2" : value > 0 ? "heat-1" : "heat-0";
  };
  return <section className="space-y-2">
    <div className="ledger-heading"><div><h2>Consistency grid</h2><p>Last 12 weeks of completed work and daily scores.</p></div><div className="streak-stat"><b>🔥 {currentStreak}d</b><span>best {longestStreak}d</span></div></div>
    <div className="streak-grid-wrap" aria-label="Last twelve weeks activity grid"><div className="streak-weekdays"><span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span></div><div className="streak-grid">{grid.map((week, index) => <div className="streak-week" key={index}>{week.map(({ key, day }) => <span key={key} title={`${key}: ${day ? `${day.completed}/${day.planned} tasks` : "no activity"}`} className={`heat-cell ${tone(day)}`} />)}</div>)}</div></div>
  </section>;
}
