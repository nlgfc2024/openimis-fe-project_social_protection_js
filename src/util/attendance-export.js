import { locationFormatter } from './searcher-utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const parseJson = (value) => {
  if (typeof value !== 'string') return value || {};
  try {
    return JSON.parse(value);
  } catch (error) {
    return {};
  }
};

export const downloadAttendancePdf = ({ project, beneficiaries, isGroup = false }) => {
  const workingDays = Math.max(0, Number(project?.workingDays) || 0);
  const projectLocation = locationFormatter(project?.location);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const staticHeaders = [
    'No.', 'Beneficiary', 'National ID', 'Sex', 'TA', 'GVH', 'Village', 'Form No.',
  ];
  const dayHeaders = Array.from({ length: workingDays }, (_, index) => `Day\n${index + 1}`);
  const workColumnStyles = Array.from({ length: workingDays + 1 }, (_, index) => [
    index + staticHeaders.length,
    { cellWidth: 5 },
  ]).reduce((styles, [index, style]) => ({ ...styles, [index]: style }), {});
  const body = (beneficiaries || []).map((row, index) => {
    const person = isGroup ? row.group?.head : row.individual;
    const jsonExt = row.jsonExt || {};
    const individualJsonExt = parseJson(person?.jsonExt);
    const location = locationFormatter(isGroup ? row.group?.location : row.individual?.location);

    return [
      index + 1,
      [person?.firstName, person?.lastName].filter(Boolean).join(' '),
      jsonExt.national_id || jsonExt.nationalId || '',
      jsonExt.sex || jsonExt.gender || individualJsonExt.sex || individualJsonExt.gender || '',
      location[1] || '',
      location[2] || '',
      location[3] || '',
      isGroup ? row.group?.code : jsonExt.form_number || individualJsonExt.form_number || '',
      ...Array(workingDays).fill(''),
      '',
    ];
  });

  doc.setFontSize(16);
  doc.text('Project Log Sheet', 148.5, 13, { align: 'center' });
  doc.setFontSize(7);
  doc.text('Monthly Works Register for Beneficiaries', 148.5, 19, { align: 'center' });
  doc.setFontSize(6);
  doc.text(`District: ${projectLocation[0] || ''}`, 10, 27);
  doc.text(`Micro-catchment: ${project?.microCatchment?.name || ''}`, 58, 27);
  doc.text(`Sector: ${project?.activity?.name || ''}`, 118, 27);
  doc.text(`Project Name: ${project?.name || ''}`, 168, 27);
  doc.text(`Code: ${project?.code || ''}`, 287, 27, { align: 'right' });

  autoTable(doc, {
    startY: 31,
    head: [[
      ...staticHeaders.map((header) => ({ content: header, rowSpan: 2 })),
      { content: 'Amount of Work Done', colSpan: workingDays + 1 },
    ], [...dayHeaders, 'Total']],
    body,
    theme: 'grid',
    margin: { left: 5, right: 5, bottom: 5 },
    styles: {
      fontSize: 4.5,
      cellPadding: 0.55,
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.18,
      lineColor: [80, 80, 80],
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 4.5,
      lineWidth: 0.22,
      lineColor: [40, 40, 40],
    },
    columnStyles: {
      0: { cellWidth: 5 }, 1: { cellWidth: 22, halign: 'left' }, 2: { cellWidth: 17 },
      3: { cellWidth: 6 }, 4: { cellWidth: 16, halign: 'left' }, 5: { cellWidth: 20, halign: 'left' },
      6: { cellWidth: 22, halign: 'left' }, 7: { cellWidth: 13 },
      ...workColumnStyles,
    },
  });

  const filenamePart = (project?.code || project?.name || 'project').replace(/[^a-z0-9_-]+/gi, '_');
  doc.save(`attendance_${filenamePart}.pdf`);
};
