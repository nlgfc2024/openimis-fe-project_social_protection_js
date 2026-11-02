import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import malawiCoatOfArms from '../assets/malawi-coat-of-arms.png';
import { beneficiaryIdentifiers, firstValue } from './beneficiary-identifiers';
import { locationFormatter } from './searcher-utils';

const PAGE = {
  width: 297, height: 210, left: 6, right: 6, top: 6, bottom: 8,
};
const TABLE_START_Y = 48;
const DAY_COLUMN_MIN_WIDTH = 5;

const STATIC_COLUMNS = [
  { key: 'number', translationKey: 'projectBeneficiaries.logSheetPdf.number', minWidth: 5, maxWidth: 5 },
  {
    key: 'beneficiary',
    translationKey: 'projectBeneficiaries.logSheetPdf.beneficiary',
    minWidth: 17,
    maxWidth: 30,
    wrap: true,
  },
  { key: 'nationalId', translationKey: 'projectBeneficiaries.nationalId', minWidth: 10, maxWidth: 18, fitText: true },
  {
    key: 'sex',
    translationKey: 'projectBeneficiaries.logSheetPdf.sex',
    minWidth: 5,
    maxWidth: 5,
    fitText: true,
  },
  { key: 'ta', translationKey: 'location.locationType.1', minWidth: 10, maxWidth: 16, wrap: true },
  { key: 'gvh', translationKey: 'location.locationType.2', minWidth: 13, maxWidth: 24, wrap: true },
  { key: 'village', translationKey: 'location.locationType.3', minWidth: 12, maxWidth: 22, wrap: true },
  {
    key: 'phoneAccount',
    translationKey: 'projectBeneficiaries.logSheetPdf.phoneAccount',
    minWidth: 10,
    maxWidth: 18,
    fitText: true,
  },
  {
    key: 'formNumber',
    translationKey: 'projectBeneficiaries.logSheetPdf.formNumber',
    minWidth: 9,
    maxWidth: 15,
    fitText: true,
  },
];

const personSex = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (['f', 'female', 'woman', 'mkazi'].includes(normalized)) return 'F';
  if (['m', 'male', 'man', 'mwamuna'].includes(normalized)) return 'M';
  if (['o', 'other'].includes(normalized)) return 'O';
  return String(value || '').trim();
};

const fitTextToLines = (doc, text, width, maxLines) => {
  const wrapped = doc.splitTextToSize(text, width);
  const lines = (Array.isArray(wrapped) ? wrapped : [wrapped]).slice(0, maxLines);
  if (wrapped.length > maxLines) {
    let lastLine = lines[maxLines - 1];
    while (lastLine && doc.getTextWidth(`${lastLine}...`) > width) {
      lastLine = lastLine.slice(0, -1).trimEnd();
    }
    lines[maxLines - 1] = `${lastLine}...`;
  }
  return lines;
};

const addHeaderText = (doc, label, value, x, y, width, maxLines = 2) => {
  const text = `${label}: ${value || ''}`;
  doc.text(fitTextToLines(doc, text, width, maxLines), x, y);
};

const fitCellText = (doc, cell, value, columnWidth) => {
  const text = String(value || '');
  if (!text) return;
  const padding = Number(cell.styles.cellPadding || 0) * 2;
  const availableWidth = Math.max(0, columnWidth - padding);
  const currentSize = cell.styles.fontSize || 5.7;
  doc.setFontSize(currentSize);
  const textWidth = doc.getTextWidth(text);
  if (textWidth > availableWidth) {
    // Keep identifiers on one line; only reduce the text as far as is needed.
    cell.styles.fontSize = Math.max(4.2, (currentSize * availableWidth) / textWidth);
  }
};

const calculateColumnWidth = (doc, values, header, minWidth, maxWidth) => {
  doc.setFontSize(5.7);
  const valueWidth = Math.max(0, ...values.map((value) => doc.getTextWidth(String(value || ''))));
  doc.setFontSize(5.3);
  const headerWidth = doc.getTextWidth(header);
  const desiredWidth = Math.max(valueWidth, headerWidth) + 1.4;
  return Math.max(minWidth, Math.min(maxWidth, desiredWidth));
};

const drawPageHeader = (doc, translate, values) => {
  // The compressed logo is embedded at build time and reused on each PDF page.
  doc.addImage(malawiCoatOfArms, 'PNG', PAGE.left, PAGE.top, 18, 18);
  doc.addImage(malawiCoatOfArms, 'PNG', PAGE.width - PAGE.right - 18, PAGE.top, 18, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.text(translate('projectBeneficiaries.logSheetPdf.title'), PAGE.width / 2, 12, { align: 'center' });
  doc.setFontSize(6.5);
  doc.text(translate('projectBeneficiaries.logSheetPdf.subtitle'), PAGE.width / 2, 19, { align: 'center' });
  doc.setFontSize(5.5);
  addHeaderText(doc, translate('location.locationType.0'), values.location, 6, 27, 47);
  addHeaderText(doc, translate('projectBeneficiaries.logSheetPdf.microCatchment'), values.microCatchment, 54, 27, 59);
  addHeaderText(doc, translate('projectBeneficiaries.logSheetPdf.sector'), values.sector, 114, 27, 49);
  addHeaderText(doc, translate('projectBeneficiaries.logSheetPdf.projectName'), values.projectName, 164, 27, 92);
  addHeaderText(doc, translate('projectBeneficiaries.logSheetPdf.code'), values.code, 257, 27, 34);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  addHeaderText(doc, translate('projectBeneficiaries.logSheetPdf.subActivity'), values.subActivity, 6, 37, 140);
  addHeaderText(doc, translate('projectBeneficiaries.logSheetPdf.unitOfMeasure'), values.unitOfMeasure, 150, 37, 141);
  doc.setFont('helvetica', 'normal');
};

export const downloadLogSheetPdf = ({
  project, beneficiaries, isGroup = false, translate,
}) => {
  const projectWorkingDays = Number(project?.workingDays);
  const workingDays = Number.isFinite(projectWorkingDays)
    ? Math.max(0, Math.floor(projectWorkingDays))
    : 0;
  const projectLocation = locationFormatter(project?.location);
  const subActivity = project?.subActivity || project?.activity?.subActivity || firstValue(
    [project?.jsonExt, project?.activity?.jsonExt],
    ['sub_activity', 'subActivity'],
  );
  const unitOfMeasure = project?.unitOfMeasure || project?.activity?.unitOfMeasure || firstValue(
    [project?.jsonExt, project?.activity?.jsonExt],
    ['unit_of_measure', 'unitOfMeasure'],
  );
  // A4 landscape is explicit so browser/printer defaults cannot fall back to Letter.
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const staticColumns = STATIC_COLUMNS.map((column) => ({
    ...column,
    header: translate(column.translationKey),
  }));
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

    const values = {
      number: index + 1,
      beneficiary: [person?.firstName, person?.lastName].filter(Boolean).join(' '),
      nationalId: identifiers.nationalId,
      sex: personSex(identifiers.sex),
      ta: location[1] || '',
      gvh: location[2] || '',
      village: location[3] || '',
      phoneAccount: identifiers.paymentAccount || identifiers.phoneNumber || '',
      formNumber: identifiers.formNumber,
    };
    return [...staticColumns.map(({ key }) => values[key]), ...Array(workingDays).fill('')];
  });
  const measuredStaticColumns = staticColumns.map((column, index) => ({
    ...column,
    width: calculateColumnWidth(
      doc,
      body.map((row) => row[index]),
      column.header,
      column.minWidth,
      column.maxWidth,
    ),
  }));
  const contentWidth = PAGE.width - PAGE.left - PAGE.right;
  const staticColumnsWidth = measuredStaticColumns.reduce((total, column) => total + column.width, 0);
  const availableDayWidth = contentWidth - staticColumnsWidth;
  const daysPerPage = Math.max(1, Math.floor(availableDayWidth / DAY_COLUMN_MIN_WIDTH));
  const dayGroupCount = workingDays ? Math.ceil(workingDays / daysPerPage) : 1;
  const daysPerGroup = workingDays ? Math.ceil(workingDays / dayGroupCount) : 0;
  const dayColumnWidth = workingDays ? availableDayWidth / daysPerGroup : 0;
  const dayGroups = Array.from({ length: dayGroupCount }, (_, index) => ({
    start: index * daysPerGroup,
    count: Math.min(daysPerGroup, workingDays - (index * daysPerGroup)),
  }));
  const headerValues = {
    location: projectLocation[0],
    microCatchment: project?.microCatchment?.name,
    sector: project?.activity?.name,
    projectName: project?.name,
    code: project?.code,
    subActivity,
    unitOfMeasure,
  };

  dayGroups.forEach(({ start, count }, groupIndex) => {
    if (groupIndex > 0) doc.addPage();
    const segmentBody = body.map((row) => [
      ...row.slice(0, measuredStaticColumns.length),
      ...row.slice(measuredStaticColumns.length + start, measuredStaticColumns.length + start + count),
    ]);
    const segmentHeaders = measuredStaticColumns.map((column) => column.header);
    const head = count > 0 ? [[
      ...measuredStaticColumns.map((column) => ({ content: column.header, rowSpan: 2 })),
      {
        content: translate('projectBeneficiaries.logSheetPdf.amountOfWorkDone'),
        colSpan: count,
      },
    ], Array.from({ length: count }, (_, dayIndex) => (
      `${translate('project.day')}\n${start + dayIndex + 1}`
    ))] : [segmentHeaders];
    const columnStyles = measuredStaticColumns.reduce((styles, column, index) => {
      styles[index] = {
        cellWidth: column.width,
        ...(column.wrap ? { overflow: 'linebreak' } : {}),
      };
      return styles;
    }, {});
    for (let dayIndex = 0; dayIndex < count; dayIndex += 1) {
      columnStyles[measuredStaticColumns.length + dayIndex] = { cellWidth: dayColumnWidth };
    }

    autoTable(doc, {
      startY: TABLE_START_Y,
      head,
      body: segmentBody,
      theme: 'grid',
      showHead: 'everyPage',
      margin: {
        left: PAGE.left, right: PAGE.right, top: TABLE_START_Y, bottom: PAGE.bottom,
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
        overflow: 'linebreak',
        lineWidth: 0.22,
        lineColor: [40, 40, 40],
      },
      columnStyles,
      didDrawPage: () => drawPageHeader(doc, translate, headerValues),
      didParseCell: (data) => {
        const column = measuredStaticColumns[data.column.index];
        if (data.section === 'body' && column?.fitText) {
          fitCellText(doc, data.cell, data.cell.raw, column.width);
        }
      },
    });
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
