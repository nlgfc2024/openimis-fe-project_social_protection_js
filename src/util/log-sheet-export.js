import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { beneficiaryIdentifiers } from './beneficiary-identifiers';
import { locationFormatter } from './searcher-utils';

export const downloadLogSheetPdf = ({
  project, beneficiaries, isGroup = false, translate,
}) => {
  const workingDays = Math.max(0, Number(project?.workingDays) || 0);
  const projectLocation = locationFormatter(project?.location);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const staticHeaders = [
    translate('projectBeneficiaries.logSheetPdf.number'),
    translate('projectBeneficiaries.logSheetPdf.beneficiary'),
    translate('projectBeneficiaries.nationalId'),
    translate('projectBeneficiaries.logSheetPdf.sex'),
    translate('location.locationType.1'),
    translate('location.locationType.2'),
    translate('location.locationType.3'),
    translate('projectBeneficiaries.logSheetPdf.formNumber'),
  ];
  const dayHeaders = Array.from(
    { length: workingDays },
    (_, index) => `${translate('project.day')}\n${index + 1}`,
  );
  const workColumnStyles = Array.from({ length: workingDays + 1 }, (_, index) => [
    index + staticHeaders.length,
    { cellWidth: 5 },
  ]).reduce((styles, [index, style]) => ({ ...styles, [index]: style }), {});
  const sortedBeneficiaries = [...(beneficiaries || [])].sort((left, right) => {
    const leftPerson = isGroup ? left.group?.head : left.individual;
    const rightPerson = isGroup ? right.group?.head : right.individual;
    const firstNameOrder = (leftPerson?.firstName || '').localeCompare(
      rightPerson?.firstName || '', undefined, { sensitivity: 'base' },
    );
    if (firstNameOrder !== 0) return firstNameOrder;

    return (leftPerson?.lastName || '').localeCompare(
      rightPerson?.lastName || '', undefined, { sensitivity: 'base' },
    );
  });
  const body = sortedBeneficiaries.map((row, index) => {
    const person = isGroup ? row.group?.head : row.individual;
    const identifiers = beneficiaryIdentifiers(row, isGroup);
    const location = locationFormatter(isGroup ? row.group?.location : row.individual?.location);

    return [
      index + 1,
      [person?.firstName, person?.lastName].filter(Boolean).join(' '),
      identifiers.nationalId,
      identifiers.sex,
      location[1] || '',
      location[2] || '',
      location[3] || '',
      identifiers.formNumber,
      ...Array(workingDays).fill(''),
      '',
    ];
  });

  doc.setFontSize(16);
  doc.text(translate('projectBeneficiaries.logSheetPdf.title'), 148.5, 13, { align: 'center' });
  doc.setFontSize(7);
  doc.text(translate('projectBeneficiaries.logSheetPdf.subtitle'), 148.5, 19, { align: 'center' });
  doc.setFontSize(6);
  doc.text(`${translate('location.locationType.0')}: ${projectLocation[0] || ''}`, 10, 27);
  doc.text(`${translate('projectBeneficiaries.logSheetPdf.microCatchment')}: ${project?.microCatchment?.name || ''}`, 58, 27);
  doc.text(`${translate('projectBeneficiaries.logSheetPdf.sector')}: ${project?.activity?.name || ''}`, 118, 27);
  doc.text(`${translate('projectBeneficiaries.logSheetPdf.projectName')}: ${project?.name || ''}`, 168, 27);
  doc.text(`${translate('projectBeneficiaries.logSheetPdf.code')}: ${project?.code || ''}`, 287, 27, { align: 'right' });

  autoTable(doc, {
    startY: 31,
    head: [[
      ...staticHeaders.map((header) => ({ content: header, rowSpan: 2 })),
      {
        content: translate('projectBeneficiaries.logSheetPdf.amountOfWorkDone'),
        colSpan: workingDays + 1,
      },
    ], [...dayHeaders, translate('projectBeneficiaries.logSheetPdf.total')]],
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
  doc.save(`log_sheet_${filenamePart}.pdf`);
};
