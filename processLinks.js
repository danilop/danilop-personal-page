const fs = require("fs-extra");
const path = require("path");
const ogs = require("open-graph-scraper");
const crypto = require('crypto');

function removeAfter(s, t) {
  let n = s.lastIndexOf(t);
  return s.substr(0, n != -1 ? n : s.length);
}

function link2hash(link) {
  const digest = crypto.createHash('sha256').update(link).digest('hex');
  console.log (digest);
  return digest;
}

async function getLinksData(links, cacheFolderName) {
  const linksData = [];

  for (let link of links) {
  
    let cacheFileName = path.join(cacheFolderName, link2hash(link));
    
    let results;
    try {
      results = fs.readJsonSync(cacheFileName);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
    
    if (results === undefined) {
      const options = { url: link };
      results = await ogs(options);
      console.log("results:", results);
      fs.writeJsonSync(cacheFileName, results);
    } else {
      console.log("cached results:", results);
    }

    let title;
    let subtitle = null;
    switch (results.data.ogSiteName) {
      case "Amazon Web Services":
        title = removeAfter(results.data.ogTitle, " | ");
        break;
      case "Speaker Deck":
        title = results.data.ogTitle;
        subtitle = results.data.ogDescription.split("\n")[0];
        break;
      default:
        title = results.data.ogTitle;
    }
    linksData.push({
      title: title,
      subtitle: subtitle,
      url: results.data.ogUrl,
      description: results.data.ogDescription,
      imageUrl: results.data.ogImage.url
    });
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

  for (let linkData of linksData) {
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

async function processHtmlFile(inputFileName, outputFileName, cacheFolderName) {
  const htmlData = fs.readFileSync(inputFileName);
  const htmlLines = htmlData.toString().split(/(?:\r\n|\r|\n)/g);
  const outputLines = [];

  for (let line of htmlLines) {
    let linksToProcess = line.match(
      /^\s*<!--\s?processLinks\s?([^\s]*)\s?([^\s]*)\s?([^\s]*)\s?(.*)?\s?-->\s*$/
    );
    if (linksToProcess) {
      console.log(line);
      linksFileName = linksToProcess[1];
      firstWidth = linksToProcess[2];
      secondWidth = linksToProcess[3];
      limit = linksToProcess[4];
      outputLines.push(
        await processLinks(linksFileName, cacheFolderName, firstWidth, secondWidth, limit)
      );
    } else {
      outputLines.push(line);
    }
  }

  fs.writeFileSync(outputFileName, outputLines.join("\r\n"));
}

async function processFolder(inputFolderName, outputFolderName, cacheFolderName) {
  const files = fs.readdirSync(inputFolderName);
  for (file of files) {
    await processHtmlFile(
      path.join(inputFolderName, file),
      path.join(outputFolderName, file),
      cacheFolderName
    );
  }
}

(async () => {
  const staticFolderName = process.argv[2];
  const inputFolderName = process.argv[3];
  const outputFolderName = process.argv[4];
  const cacheFolderName = process.argv[5];
  fs.copySync(staticFolderName, outputFolderName);
  fs.ensureDir(cacheFolderName);
  await processFolder(inputFolderName, outputFolderName, cacheFolderName);
})().catch(e => {
  console.error(e);
});
