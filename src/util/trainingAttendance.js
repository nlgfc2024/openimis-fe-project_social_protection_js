export const hasAttendanceChanges = (current = {}, original = {}) => {
  const value = (entry) => entry?.percentComplete == null || entry.percentComplete === ''
    ? null : Number(entry.percentComplete);
  return [...new Set([...Object.keys(current), ...Object.keys(original)])]
    .some((key) => value(current[key]) !== value(original[key]));
};

// Saved completion is authoritative on the backend. Preview only dirty rows.
export const trainingCompletionColumns = (topics = [], editing = false) => {
  const modules = new Map();
  [...topics].sort((a, b) => Number(a.sequence) - Number(b.sequence)).forEach((topic) => {
    if (!topic.module?.id) return;
    if (!modules.has(topic.module.id)) modules.set(topic.module.id, { module: topic.module, sequences: [] });
    modules.get(topic.module.id).sequences.push(topic.sequence);
  });
  return [...modules.values()].map(({ module, sequences }) => {
    const completion = (row) => {
      if (editing && row.attendanceDirty) {
        const tickedTopics = sequences.filter((sequence) => (
          Number(row.projectTimeEntriesDict?.[`day${sequence}`]?.percentComplete) === 100
        )).length;
        return { tickedTopics, totalTopics: sequences.length, percentage: 100 * tickedTopics / sequences.length };
      }
      return row.moduleCompletion?.find((saved) => String(saved.module?.id) === String(module.id));
    };
    return {
      title: module.name,
      field: `trainingModuleCompletion.${module.id}`,
      editable: 'never',
      filtering: false,
      width: '180px',
      render: (row) => {
        const saved = completion(row);
        if (!saved || !Number.isFinite(Number(saved.percentage))) return '\u2014';
        // Truncate rather than round a value below a payment threshold up to it.
        const percentage = (Math.floor(Number(saved.percentage) * 10) / 10).toFixed(1);
        return `${saved.tickedTopics}/${saved.totalTopics} (${percentage}%)`;
      },
      customSort: (a, b) => (completion(a)?.percentage ?? -1) - (completion(b)?.percentage ?? -1),
    };
  });
};
