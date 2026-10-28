import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import malawiCoatOfArms from '../assets/malawi-coat-of-arms.png';
import mbwezeraLogo from '../assets/mbwezera-logo.png';
import { beneficiaryIdentifiers } from './beneficiary-identifiers';
import { locationFormatter } from './searcher-utils';

const PAGE = {
  width: 297, height: 210, left: 6, right: 6, top: 6, bottom: 8,
};

// These match the compact proportions of the legacy works register.  Thirty
// readable day cells must fit beside the participant data on A4 landscape.
// Minimum and maximum widths for the participant columns. Their final width
// is calculated from the actual values in each log sheet; the remaining A4
// width is assigned to the day columns.
const STATIC_COLUMN_MIN_WIDTHS = [5, 17, 10, 5, 10, 13, 12, 10, 9];
const STATIC_COLUMN_MAX_WIDTHS = [5, 30, 18, 5, 16, 24, 22, 18, 15];

const personSex = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized.startsWith('f')) return 'F';
  if (normalized.startsWith('m')) return 'M';
  return String(value || '').trim();
};

const projectJson = (project) => {
  if (typeof project?.jsonExt !== 'string') return project?.jsonExt || {};
  try { return JSON.parse(project.jsonExt); } catch (error) { return {}; }
};

const valueFrom = (sources, keys) => {
  for (const source of sources) {
    for (const key of keys) {
      if (source?.[key] !== undefined && source[key] !== null && source[key] !== '') return source[key];
    }
  }
  return '';
};

const addHeaderText = (doc, label, value, x, width) => {
  doc.text(doc.splitTextToSize(`${label}: ${value || ''}`, width), x, 28, { maxWidth: width });
};

const fitCellText = (doc, cell, value) => {
  const text = String(value || '');
  if (!text) return;
  const padding = Number(cell.styles.cellPadding || 0) * 2;
  const availableWidth = cell.width - padding;
  const currentSize = cell.styles.fontSize || 5.7;
  doc.setFontSize(currentSize);
  const textWidth = doc.getTextWidth(text);
  if (textWidth > availableWidth) {
    // Keep identifiers on one line; only reduce the text as far as is needed.
    cell.styles.fontSize = Math.max(4.2, (currentSize * availableWidth) / textWidth);
  }
};

const calculateColumnWidth = (doc, values, header, index) => {
  doc.setFontSize(5.7);
  const valueWidth = Math.max(0, ...values.map((value) => doc.getTextWidth(String(value || ''))));
  doc.setFontSize(5.3);
  // Phone/Account is allowed to use its two-line heading, so its label does
  // not force a largely empty column to be wider than the actual account.
  const headerWidth = index === 7 ? 0 : doc.getTextWidth(header);
  const desiredWidth = Math.max(valueWidth, headerWidth) + 1.4;
  return Math.max(
    STATIC_COLUMN_MIN_WIDTHS[index],
    Math.min(STATIC_COLUMN_MAX_WIDTHS[index], desiredWidth),
  );
};

export const downloadLogSheetPdf = ({
  project, beneficiaries, isGroup = false, translate,
}) => {
  const workingDays = Math.max(0, Number(project?.workingDays) || 0);
  const projectLocation = locationFormatter(project?.location);
  const projectExtensions = projectJson(project);
  const subActivity = valueFrom(
    [project?.subActivity, project?.activity?.subActivity, projectExtensions],
    ['name', 'sub_activity', 'subActivity'],
  ) || project?.activity?.name || '';
  const unitOfMeasure = valueFrom(
    [project?.unitOfMeasure, project?.activity?.unitOfMeasure, projectExtensions],
    ['name', 'unit_of_measure', 'unitOfMeasure'],
  );
  // A4 landscape is explicit so browser/printer defaults cannot fall back to Letter.
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const staticHeaders = [
    translate('projectBeneficiaries.logSheetPdf.number'),
    translate('projectBeneficiaries.logSheetPdf.beneficiary'),
    translate('projectBeneficiaries.nationalId'),
    translate('projectBeneficiaries.logSheetPdf.sex'),
    translate('location.locationType.1'),
    translate('location.locationType.2'),
    translate('location.locationType.3'),
    translate('projectBeneficiaries.logSheetPdf.phoneAccount'),
    translate('projectBeneficiaries.logSheetPdf.formNumber'),
  ];
  const dayHeaders = Array.from(
    { length: workingDays },
    (_, index) => `${translate('project.day')}\n${index + 1}`,
  );
  const workColumnCount = workingDays;
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
      personSex(identifiers.sex),
      location[1] || '',
      location[2] || '',
      location[3] || '',
      identifiers.paymentAccount || identifiers.phoneNumber || '',
      identifiers.formNumber,
      ...Array(workingDays).fill(''),
    ];
  });
  const staticColumnWidths = staticHeaders.map((header, index) => calculateColumnWidth(
    doc,
    body.map((row) => row[index]),
    header,
    index,
  ));
  const contentWidth = PAGE.width - PAGE.left - PAGE.right;
  const staticColumnsWidth = staticColumnWidths.reduce((total, width) => total + width, 0);
  const dayColumnWidth = workColumnCount
    ? (contentWidth - staticColumnsWidth) / workColumnCount
    : 0;
  const workColumnStyles = Array.from({ length: workColumnCount }, (_, index) => [
    index + staticHeaders.length,
    { cellWidth: dayColumnWidth, overflow: 'ellipsize' },
  ]).reduce((styles, [index, style]) => ({ ...styles, [index]: style }), {});

  // These PNG data are embedded by Rollup at build time, not loaded from a URL.
  doc.addImage(malawiCoatOfArms, 'PNG', PAGE.left, PAGE.top, 18, 18);
  doc.addImage(mbwezeraLogo, 'PNG', PAGE.width - PAGE.right - 42, PAGE.top + 1, 42, 16);
  doc.setFontSize(13);
  doc.text(translate('projectBeneficiaries.logSheetPdf.title'), PAGE.width / 2, 12, { align: 'center' });
  doc.setFontSize(6.5);
  doc.text(translate('projectBeneficiaries.logSheetPdf.subtitle'), PAGE.width / 2, 19, { align: 'center' });
  doc.setFontSize(5.5);
  addHeaderText(doc, translate('location.locationType.0'), projectLocation[0], 6, 47);
  addHeaderText(doc, translate('projectBeneficiaries.logSheetPdf.microCatchment'), project?.microCatchment?.name, 54, 59);
  addHeaderText(doc, translate('projectBeneficiaries.logSheetPdf.sector'), project?.activity?.name, 114, 49);
  addHeaderText(doc, translate('projectBeneficiaries.logSheetPdf.projectName'), project?.name, 164, 92);
  addHeaderText(doc, translate('projectBeneficiaries.logSheetPdf.code'), project?.code, 257, 34);
  doc.setFontSize(5.8);
  doc.setFont(undefined, 'bold');
  doc.text(`${translate('projectBeneficiaries.logSheetPdf.subActivity')}: ${subActivity}`, PAGE.left, 34);
  doc.text(`${translate('projectBeneficiaries.logSheetPdf.unitOfMeasure')}: ${unitOfMeasure}`, 88, 34);
  doc.setFont(undefined, 'normal');

  autoTable(doc, {
    startY: 37,
    head: workingDays > 0 ? [[
      ...staticHeaders.map((header, index) => ({
        content: index === 7 ? header.replace(' / ', ' /\n') : header,
        rowSpan: 2,
      })),
      {
        content: translate('projectBeneficiaries.logSheetPdf.amountOfWorkDone'),
        colSpan: workColumnCount,
      },
    ], dayHeaders] : [staticHeaders],
    body,
    theme: 'grid',
    showHead: 'everyPage',
    margin: {
      left: PAGE.left, right: PAGE.right, top: PAGE.top, bottom: PAGE.bottom,
    },
    styles: {
      fontSize: 5.7,
      cellPadding: 0.35,
      halign: 'center',
      valign: 'middle',
      overflow: 'ellipsize',
      lineWidth: 0.14,
      lineColor: [80, 80, 80],
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 5.3,
      lineWidth: 0.22,
      lineColor: [40, 40, 40],
    },
    columnStyles: {
      0: { cellWidth: staticColumnWidths[0] },
      // Keep the register easy to scan: every participant value is centred in
      // its own column. Long names and locations may still break at a space,
      // never in the middle of a word.
      1: { cellWidth: staticColumnWidths[1], halign: 'center', overflow: 'linebreak' },
      2: { cellWidth: staticColumnWidths[2] }, 3: { cellWidth: staticColumnWidths[3] },
      4: { cellWidth: staticColumnWidths[4], halign: 'center', overflow: 'linebreak' },
      5: { cellWidth: staticColumnWidths[5], halign: 'center', overflow: 'linebreak' },
      6: { cellWidth: staticColumnWidths[6], halign: 'center', overflow: 'linebreak' },
      7: { cellWidth: staticColumnWidths[7] }, 8: { cellWidth: staticColumnWidths[8] },
      ...workColumnStyles,
    },
    didParseCell: (data) => {
      // IDs and payment details must never overflow or wrap into another cell.
      if (data.section === 'body' && [2, 3, 7, 8].includes(data.column.index)) {
        fitCellText(doc, data.cell, data.cell.raw);
      }
    },
  });

  const printDate = new Intl.DateTimeFormat(undefined, {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date());
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFontSize(5.5);
    doc.text(`${translate('projectBeneficiaries.logSheetPdf.printDate')}: ${printDate}`, PAGE.left, PAGE.height - 3);
    doc.text(`${page}/${pages}`, PAGE.width - PAGE.right, PAGE.height - 3, { align: 'right' });
  }

  const filenamePart = (project?.code || project?.name || 'project').replace(/[^a-z0-9_-]+/gi, '_');
  doc.save(`log_sheet_${filenamePart}.pdf`);
};
