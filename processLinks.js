const fs = require("fs-extra");
const path = require("path");
const ogs = require("open-graph-scraper");
const crypto = require('crypto');

function removeAfter(s, t) {
  return s.split(t)[0];
}

function removeAny(s, t) {
  return s.replace(t, '');
}

function makeOrdinalsSup(s) {
  return s.replace(/([0-9]+)(st|nd|rd|th)\b/, "$1<sup>$2</sup>");
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

    let title = results.data.ogTitle;
    let subtitle = null;
    switch (results.data.ogSiteName) {
      case "Amazon Web Services":
        title = removeAfter(title, " | ");
        break;
      case "Speaker Deck":
        subtitle = removeAfter(results.data.ogDescription, "\n");
        subtitle = makeOrdinalsSup(subtitle);
        break;
      default:
        // YouTube Videos
        title = removeAfter(title, " - ");
        title = removeAfter(title, " – ");
        title = removeAfter(title, " by ");
        title = removeAny(title, /\[.*\]/);
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
      linksFileName = path.join(dataFolderName, linksToProcess[1]);
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

async function processFolder(dataFolderName, inputFolderName, outputFolderName, cacheFolderName) {
  const files = fs.readdirSync(inputFolderName);
  for (file of files) {
    await processHtmlFile(
      path.join(inputFolderName, file),
      path.join(outputFolderName, file),
      dataFolderName, cacheFolderName
    );
  }
}

(async () => {
  const dataFolderName = process.argv[2];
  const staticFolderName = process.argv[3];
  const inputFolderName = process.argv[4];
  const outputFolderName = process.argv[5];
  const cacheFolderName = process.argv[6];
  fs.copySync(staticFolderName, outputFolderName);
  fs.ensureDir(cacheFolderName);
  await processFolder(dataFolderName, inputFolderName, outputFolderName, cacheFolderName);
})().catch(e => {
  console.error(e);
});
