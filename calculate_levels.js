const levels = [];
// Level 0 is unused/placeholder
levels.push({ level: 0, cost: 0 });

for (let i = 1; i <= 100; i++) {
    const newCost = i * 100;
    levels.push({ level: i, cost: newCost });
}

console.log("| Level | Cost (EXP) |");
console.log("| :--- | :--- |");
levels.forEach(l => {
    if (l.level > 0) console.log(`| ${l.level} | ${l.cost.toLocaleString()} |`);
});
