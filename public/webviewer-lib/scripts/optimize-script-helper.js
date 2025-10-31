const path = require('path');

/**
 * Optimizes file management based on the provided options.
 *
 * @param {{
 *   excludeOptimizedWorkers: 'y' | 'n',
 *   isNPMPackage: boolean,
 *   office: 'y' | 'n',
 *   pdfnetProd: 'y' | 'n',
 *   salesforceSupport: 'y' | 'n',
 *   useContentEdit: 'y' | 'n',
 *   useFullAPI: 'y' | 'n',
 *   useOfficeEditor: 'y' | 'n',
 *   useSpreadsheetEditor: 'y' | 'n',
 *   useSourceMap: 'y' | 'n',
 *   useWebComponent: 'y' | 'n',
 *   webViewerServer: 'y' | 'n',
* }} options - Configuration options for file management.
 * @param {string} resourceDir - Directory where resources will be stored.
 * @param {string} wvFolder - WebViewer folder name.
 * @returns {Object} An object containing arrays of files to delete, relocate, rename, etc.
 * @returns {Array} return.filesToDelete - List of files to delete.
 * @returns {Array} return.filesToDeleteAfterMoving - List of files to delete after moving.
 * @returns {Array} return.filesToDeleteAsWildcard - List of files to delete using wildcard patterns.
 * @returns {Array} return.filesToRelocate - List of files to relocate.
 * @returns {Array} return.filesToRemoveSync - List of files to remove synchronously.
 * @returns {Array} return.filesToRename - List of files to rename.
 * @returns {Array} return.resourcesForZip - List of resources to include in the zip.
 */
const optimizeFileManagement = (options, resourceDir, wvFolder) => {
  const resourcesForZip = [];
  const filesToDelete = [];
  const filesToDeleteAfterMoving = [];
  const filesToDeleteAsWildcard = [];
  const filesToRemoveSync = [];
  const filesToRename = [];
  const filesToRelocate = [];

  options = removeEmptyStringOptions(options);

  // in npm page these files does not exist
  if (!options.isNPMPackage) {
    filesToRelocate.push([path.resolve(__dirname, `../${wvFolder}/package.json`), `${resourceDir}/${wvFolder}/`, true]);
    filesToRelocate.push([path.resolve(__dirname, `../${wvFolder}/webviewer.min.js`), `${resourceDir}/${wvFolder}/`, true]);
  }

  if (options.excludeOptimizedWorkers === 'y') {
    filesToDelete.push(
      path.resolve(__dirname, `../${wvFolder}/core/pdf/lean/optimized`),
      path.resolve(__dirname, `../${wvFolder}/core/pdf/full/optimized`)
    );
  }

  // If they are not using XOD
  if (options.webViewerServer === 'n' && options.xod === 'n') {
    // if they dont need office

    if (options.office === 'n') {
      filesToDelete.push(
        path.resolve(__dirname, `../${wvFolder}/core/office`),
        path.resolve(__dirname, `../${wvFolder}/core/legacyOffice`)
      );
    } else {
      filesToRelocate.push(
        [path.resolve(__dirname, `../${wvFolder}/core/office/OfficeWorker.js`), `${resourceDir}/office`],
        [path.resolve(__dirname, `../${wvFolder}/core/office/WebOfficeWorkerWasm.br.wasm`), `${resourceDir}/office`],
        [path.resolve(__dirname, `../${wvFolder}/core/office/WebOfficeWorkerWasm.br.js.mem`), `${resourceDir}/office`],
        [path.resolve(__dirname, `../${wvFolder}/core/office/WebOfficeWorker.br.js.mem`), `${resourceDir}/office_asm`],
        [path.resolve(__dirname, `../${wvFolder}/core/office/WebOfficeWorker.br.mem`), `${resourceDir}/office_resource`]
      );
      resourcesForZip.push(
        [`${resourceDir}/office`],
        [`${resourceDir}/office_asm`],
        [`${resourceDir}/office_resource`]
      );

      if (options.useLegacyOffice === 'n') {
        filesToDelete.push(
          path.resolve(__dirname, `../${wvFolder}/core/legacyOffice`)
        );
      } else {
        filesToRelocate.push(
          [path.resolve(__dirname, `../${wvFolder}/core/legacyOffice/LegacyOfficeWorker.js`), `${resourceDir}/legacyOffice`],
          [path.resolve(__dirname, `../${wvFolder}/core/legacyOffice/WebB2XOfficeWorkerWasm.br.wasm`), `${resourceDir}/legacyOffice`],
          [path.resolve(__dirname, `../${wvFolder}/core/legacyOffice/WebB2XOfficeWorkerWasm.br.js.mem`), `${resourceDir}/legacyOffice`],
          [path.resolve(__dirname, `../${wvFolder}/core/legacyOffice/WebB2XOfficeWorker.br.js.mem`), `${resourceDir}/legacyOffice_asm`],
          [path.resolve(__dirname, `../${wvFolder}/core/legacyOffice/WebB2XOfficeWorker.br.mem`), `${resourceDir}/legacyOffice_resource`]
        );
        resourcesForZip.push(
          [`${resourceDir}/legacyOffice`],
          [`${resourceDir}/legacyOffice_asm`],
          [`${resourceDir}/legacyOffice_resource`]
        );
      }
    }
  }

  // if they are using XOD
  else if (options.webViewerServer === 'n') {
    filesToDelete.push(
      path.resolve(__dirname, `../${wvFolder}/core/office`),
      path.resolve(__dirname, `../${wvFolder}/core/legacyOffice`)
    );
    filesToDelete.push(
      path.resolve(__dirname, `../${wvFolder}/core/pdf`)
    );
  }

  if (options.webViewerServer === 'y') {
    filesToDelete.push(
      path.resolve(__dirname, `../${wvFolder}/core/office`),
      path.resolve(__dirname, `../${wvFolder}/core/legacyOffice`),
    );
  }

  if (options.useFullAPI === 'n') {
    filesToDelete.push(
      path.resolve(__dirname, `../${wvFolder}/core/pdf/full`)
    );
    filesToRelocate.push(
      [path.resolve(__dirname, `../${wvFolder}/core/pdf/lean/optimized/PDFNetCWasm.br.js.mem`), `${resourceDir}/pdf_lean/lean/optimized`],
      [path.resolve(__dirname, `../${wvFolder}/core/pdf/lean/PDFNetC.br.mem`), `${resourceDir}/resource/lean`]
    );
    resourcesForZip.push(
      [`${resourceDir}/pdf_lean`]
    );
  } else {
    filesToDelete.push(
      path.resolve(__dirname, `../${wvFolder}/core/pdf/lean`)
    );

    if (options.pdfnetProd === 'y') {
      // replace PDFNet.js with PDFNet.prod.js
      filesToRemoveSync.push(path.resolve(__dirname, `../${wvFolder}/core/pdf/PDFNet.js`));
      filesToRename.push(
        [
          path.resolve(__dirname, `../${wvFolder}/core/pdf/PDFNet.prod.js`),
          path.resolve(__dirname, `../${wvFolder}/core/pdf/PDFNet.js`),
        ],
      );
    } else {
      filesToRemoveSync.push(path.resolve(__dirname, `../${wvFolder}/core/pdf/PDFNet.prod.js`));
    }
    filesToRelocate.push(
      [path.resolve(__dirname, `../${wvFolder}/core/pdf/full/optimized/PDFNetCWasm.br.js.mem`), `${resourceDir}/pdf_full/full/optimized`],
      [path.resolve(__dirname, `../${wvFolder}/core/pdf/full/PDFNetC.br.mem`), `${resourceDir}/resource/full`]
    );
    resourcesForZip.push(
      [`${resourceDir}/pdf_full`]
    );
  }

  if (options.useContentEdit === 'n') {
    filesToDelete.push(
      path.resolve(__dirname, `../${wvFolder}/core/contentEdit`)
    );
  } else {
    filesToRelocate.push(
      [path.resolve(__dirname, `../${wvFolder}/core/contentEdit/InfixServerWasm.br.js.mem`), `${resourceDir}/content_edit`],
      [path.resolve(__dirname, `../${wvFolder}/core/contentEdit/InfixServerWasm.br.wasm`), `${resourceDir}/content_edit`],
      [path.resolve(__dirname, `../${wvFolder}/core/contentEdit/InfixServerWasm.gz.js.mem`), `${resourceDir}/content_edit`],
      [path.resolve(__dirname, `../${wvFolder}/core/contentEdit/InfixServerModule.js`), `${resourceDir}/content_edit`],
      [path.resolve(__dirname, `../${wvFolder}/core/contentEdit/InfixServerWasm.br.mem`), `${resourceDir}/content_edit_resource`]
    );
    resourcesForZip.push(
      [`${resourceDir}/content_edit`],
      [`${resourceDir}/content_edit_resource`]
    );
  }

  if (options.useOfficeEditor === 'n') {
    filesToDelete.push(
      path.resolve(__dirname, `../${wvFolder}/core/officeEditor`)
    );
  } else {
    filesToRelocate.push(
      [path.resolve(__dirname, `../${wvFolder}/core/officeEditor/OfficeEditorWorkerWasm.br.js.mem`), `${resourceDir}/office_edit`],
      [path.resolve(__dirname, `../${wvFolder}/core/officeEditor/OfficeEditorWorkerWasm.br.wasm`), `${resourceDir}/office_edit`],
      [path.resolve(__dirname, `../${wvFolder}/core/officeEditor/OfficeEditorModule.js`), `${resourceDir}/office_edit`]
    );
    resourcesForZip.push(
      [`${resourceDir}/office_edit`]
    );
  }

  if (options.useSpreadsheetEditor === 'n') {
    filesToDelete.push(
      path.resolve(__dirname, `../${wvFolder}/core/spreadsheetEditor`)
    );
  } else {
    filesToRelocate.push(
      [path.resolve(__dirname, `../${wvFolder}/core/spreadsheetEditor/SpreadsheetEditorEngine.js`), `${resourceDir}/spreadsheetEditor`],
      [path.resolve(__dirname, `../${wvFolder}/core/spreadsheetEditor/SpreadsheetEditorEngine.wasm`), `${resourceDir}/spreadsheetEditor`],
      [path.resolve(__dirname, `../${wvFolder}/core/spreadsheetEditor/SpreadsheetEditorModule.js`), `${resourceDir}/spreadsheetEditor`],
      [path.resolve(__dirname, `../${wvFolder}/core/spreadsheetEditor/SpreadsheetEditor.css`), `${resourceDir}/spreadsheetEditor`],
      [path.resolve(__dirname, `../${wvFolder}/core/spreadsheetEditor/styles.css`), `${resourceDir}/spreadsheetEditor`],
      [path.resolve(__dirname, `../${wvFolder}/core/spreadsheetEditor/jquery-3.7.1.min.js`), `${resourceDir}/spreadsheetEditor`],
      [path.resolve(__dirname, `../${wvFolder}/core/spreadsheetEditor/jquery.mousewheel-3.1.13.min.js`), `${resourceDir}/spreadsheetEditor`],
      [path.resolve(__dirname, `../${wvFolder}/core/spreadsheetEditor/SpreadsheetEditor.js`), `${resourceDir}/spreadsheetEditor`],
    );
    resourcesForZip.push(
      [`${resourceDir}/spreadsheetEditor`],
    );
  }

  if (options.salesforceSupport === 'y') {
    filesToRelocate.push(
      [path.resolve(__dirname, `../${wvFolder}/ui/assets/fonts`), `${resourceDir}/font_assets`]
    );
    resourcesForZip.push(
      [`${resourceDir}/font_assets`]
    );
    filesToDeleteAfterMoving.push(
      { path: path.resolve(__dirname, `${resourceDir}/lib/ui/assets/fonts/webfonts`), pattern: /.ttf/ }
    );
    filesToDeleteAfterMoving.push(
      { path: path.resolve(__dirname, `${resourceDir}/lib/ui/assets/fonts`), pattern: /.woff/ }
    );

    resourcesForZip.push([`${resourceDir}/${wvFolder}`]);
  } else {
    filesToRelocate.push(
      [path.resolve(__dirname, `../${wvFolder}/core/external`), `${resourceDir}/${wvFolder}/core/`, true]
    );
  }

  if (options.useSourceMap === 'n' || options.salesforceSupport === 'y') {
    filesToDelete.push(
      path.resolve(__dirname, `../${wvFolder}/ui/webviewer-ui.min.js.map`),
      path.resolve(__dirname, `../${wvFolder}/ui/style.css.map`)
    );
    filesToDeleteAsWildcard.push(
      { path: path.resolve(__dirname, `../${wvFolder}/ui/chunks/`), pattern: /.js.map/ }
    );
  }

  if (options.useWebComponent === 'n') {
    filesToDelete.push(
      path.resolve(__dirname, `../${wvFolder}/ui/index-wc.html`)
    );
  } else {
    filesToDelete.push(
      path.resolve(__dirname, `../${wvFolder}/ui/index.html`)
    );
  }

  return {
    filesToDelete,
    filesToDeleteAfterMoving,
    filesToDeleteAsWildcard,
    filesToRelocate,
    filesToRemoveSync,
    filesToRename,
    resourcesForZip,
  };
};

const removeEmptyStringOptions = (options) => {
  return Object.keys(options).reduce((acc, key) => {
    if (key === 'isNPMPackage') {
      acc[key] = options[key];
    } else {
      acc[key] = options[key] ? options[key] : 'n';
    }
    return acc;
  }, {});
};

module.exports = {
  optimizeFileManagement
};
