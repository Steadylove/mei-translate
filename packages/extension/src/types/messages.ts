/**
 * Message types for communication between extension components
 */
export enum MessageType {
  TRANSLATE = 'translate',
  DETECT_LANG = 'detectLang',
  BATCH_TRANSLATE = 'batchTranslate',
  GET_SETTINGS = 'getSettings',
  SET_SETTING = 'setSetting',
  SHOW_WEB_TRANS = 'showWebTrans',
  OPEN_PDF_VIEWER = 'openPdfViewer',
}
