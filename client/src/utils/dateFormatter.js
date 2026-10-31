// Format Date as DD/MM/YYYY
export function formatDDMMYYYY(dateStringOrObj) {
  if (!dateStringOrObj) return '';
  const d = new Date(dateStringOrObj);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// Format Date as DD/MM/YY
export function formatDDMMYY(dateStringOrObj) {
  if (!dateStringOrObj) return '';
  const d = new Date(dateStringOrObj);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

// Format estimate as "MMM DD, YYYY" with optional "h:mm A"
export function formatTimeDateEstimate(estimateString) {
  if (!estimateString) return '-';
  const d = new Date(estimateString);
  if (isNaN(d.getTime())) {
    // If it's already a formatted string, return it
    return estimateString;
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = months[d.getMonth()];
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  const datePart = `${monthName} ${day}, ${year}`;

  // Check if estimateString contains a time component
  const hasTime = estimateString.includes('T') && !estimateString.endsWith('T00:00:00.000Z') && !estimateString.endsWith('T00:00');
  if (hasTime) {
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 becomes 12
    return `${datePart} ${hours}:${minutes} ${ampm}`;
  }

  return datePart;
}

