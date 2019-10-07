const fs = require("fs");
const path = require("path");
const ogs = require("open-graph-scraper");

function removeAfter(s, t) {
  let n = s.lastIndexOf(t);
  return s.substr(0, n != -1 ? n : s.length);
}

async function getLinksData(links) {
  const linksData = [];

  for (let link of links) {
    const options = { url: link };
    const results = await ogs(options);
    console.log("results:", results);
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

async function processLinks(fileName, firstWidth, secondWidth, limit) {
  let rawLinks = fs.readFileSync(fileName);
  console.log(rawLinks);

  let links = JSON.parse(rawLinks);
  console.log(links);

  if (limit) {
    links = links.slice(0, limit);
  }

  console.log("Loading link data...");

  const linksData = await getLinksData(links);

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
        "<h6>" +
        linkData.title +
        "</h6>" +
        (linkData.subtitle ? '<p class="font-italic small">' + linkData.subtitle + '</p>' : '') +
        "</a>" +
        "</div>" +
        "</div>"
    );
  }

  return htmlLinks.join("\r\n");
}

async function processHtmlFile(inputFileName, outputFileName) {
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
        await processLinks(linksFileName, firstWidth, secondWidth, limit)
      );
    } else {
      outputLines.push(line);
    }
  }

  fs.writeFileSync(outputFileName, outputLines.join("\r\n"));
}

async function processFolder(inputFolderName, outputFolderName) {
  const files = fs.readdirSync(inputFolderName);
  for (file of files) {
    await processHtmlFile(
      path.join(inputFolderName, file),
      path.join(outputFolderName, file)
    );
  }
}

(async () => {
  const inputFolderName = process.argv[2];
  const outputFolderName = process.argv[3];
  await processFolder(inputFolderName, outputFolderName);
})().catch(e => {
  console.error(e);
});
