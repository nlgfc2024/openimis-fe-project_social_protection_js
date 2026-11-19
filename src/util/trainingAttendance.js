// Snapshot sequence is the persisted attendance key, independent of catalogue edits.
export const trainingCompletionColumns = (topics = []) => {
  const modules = new Map();
  [...topics].sort((a, b) => Number(a.sequence) - Number(b.sequence)).forEach((topic) => {
    if (!topic.module?.id) return;
    if (!modules.has(topic.module.id)) modules.set(topic.module.id, { module: topic.module, sequences: [] });
    modules.get(topic.module.id).sequences.push(topic.sequence);
  });
  return [...modules.values()].map(({ module, sequences }) => {
    const ticked = (row) => sequences.filter((sequence) => (
      Number(row.projectTimeEntriesDict?.[`day${sequence}`]?.percentComplete) === 100
    )).length;
    return {
      title: module.name,
      field: `trainingModuleCompletion.${module.id}`,
      editable: 'never',
      filtering: false,
      width: '180px',
      render: (row) => `${ticked(row)}/${sequences.length} (${Math.round(100 * ticked(row) / sequences.length)}%)`,
      customSort: (a, b) => ticked(a) - ticked(b),
    };
  });
};
