export const API_BASE = typeof window !== 'undefined' && window.location.port === '4000'
  ? ''
  : 'http://localhost:4000';
