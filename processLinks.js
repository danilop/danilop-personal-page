const fs = require("fs-extra");
const path = require("path");
const { getLinkData, escapeHtml } = require('./lib/link-metadata');
const importedMetadata = require('./data/link-metadata.json');
const linkOverrides = require('./data/link-overrides.json');

async function getLinksData(links, cacheFolderName) {
  const linksData = [];
  for (const link of links) {
    linksData.push(await getLinkData(link, {
      cacheFolderName,
      imported: importedMetadata,
      overrides: linkOverrides
    }));
  }
  return linksData;
}

async function processLinks(fileName, cacheFolderName, firstWidth, secondWidth, limit) {
  let links = fs.readJsonSync(fileName);

  if (limit) {
    links = links.slice(0, limit);
  }

  console.log("Loading link data...");

  const linksData = await getLinksData(links, cacheFolderName);

  console.log("Rendering link data...");

  let htmlLinks = [];

  for (const record of linksData) {
    const linkData = Object.fromEntries(Object.entries(record).map(([key, value]) => [key, escapeHtml(value)]));
    htmlLinks.push(
      '<div class="row bg-light p-1 m-1">' +
        '<div class="col-sm-' +
        firstWidth +
        ' my-auto">' +
        '<a href="' +
        linkData.url +
        //'" data-toggle="' +
        //linkData.description +
        '">' +
        '<img class="img-fluid img-thumbnail" src="' +
        linkData.imageUrl +
        '" alt="' +
        linkData.title +
        '"/>' +
        "</a>" +
        "</div>" +
        '<div class="col-sm-' +
        secondWidth +
        ' my-auto">' +
        '<a href="' +
        linkData.url +
        //'" data-toggle="' +
        //linkData.description +
        '">' +
        '<h6 class="mt-1">' +
        linkData.title +
        '</h6>' +
        '</a>' +
        (linkData.subtitle
          ? '<p class="font-italic small">' + linkData.subtitle + '</p>'
          : '') +
        '</div>' +
        '</div>'
    );
  }

  return htmlLinks.join("\r\n");
}

async function processHtmlFile(inputFileName, outputFileName, dataFolderName, cacheFolderName) {
  const htmlData = fs.readFileSync(inputFileName);
  const htmlLines = htmlData.toString().split(/(?:\r\n|\r|\n)/g);
  const outputLines = [];

  for (let line of htmlLines) {
    let linksToProcess = line.match(
      /^\s*<!--\s?processLinks\s?([^\s]*)\s?([^\s]*)\s?([^\s]*)\s?(.*)?\s?-->\s*$/
    );
    if (linksToProcess) {
      console.log(line);
      const linksFileName = path.join(dataFolderName, linksToProcess[1]);
      const firstWidth = linksToProcess[2];
      const secondWidth = linksToProcess[3];
      const limit = linksToProcess[4];
      outputLines.push(
        await processLinks(linksFileName, cacheFolderName, firstWidth, secondWidth, limit)
      );
    } else {
      outputLines.push(line);
    }
  }

  fs.writeFileSync(outputFileName, outputLines.join("\r\n"));
}

async function processFolder(dataFolderName, inputFolderName, outputFolderName, cacheFolderName) {
  const files = fs.readdirSync(inputFolderName);
  for (const file of files) {
    await processHtmlFile(
      path.join(inputFolderName, file),
      path.join(outputFolderName, file),
      dataFolderName, cacheFolderName
    );
  }
}

// Main

(async () => {
  const dataFolderName = process.argv[2];
  const staticFolderName = process.argv[3];
  const inputFolderName = process.argv[4];
  const outputFolderName = process.argv[5];
  const cacheFolderName = process.argv[6];
  fs.copySync(staticFolderName, outputFolderName);
  await fs.ensureDir(cacheFolderName);
  await processFolder(dataFolderName, inputFolderName, outputFolderName, cacheFolderName);
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
