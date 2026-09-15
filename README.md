# danilop-personal-page

![Sample personal page](https://danilop.s3.amazonaws.com/Images/danilop-personal-page.png)

A simple script to populate a web page with links, retrieving link info using the Open Graph protocol (https://ogp.me).

I am using https://getbootstrap.com for the grid system.

I built it for my personal page: https://danilop.net

1. Put static assets in the `static` folder.

2. Put HTML templates with `<!-- processLinks {JSON file} {thumbnail width} {title width} [max links] -->` where you want to embed links in the `src` folder. The thumbnail and title width are using the https://getbootstrap.com grid system and should add to 12. You can optionally add a maimum number of links to process from the source list.

3. The JSON file should be in the `data` folder and contain a single JSON array of links.

4. Run `npm run build` to create the `public` folder. I use [AWS Amplify Console](https://aws.amazon.com/amplify/console/) to automate deployment.

5. Using the Open Graph protocol, this is getting all the info (title, thumbnail) from the link source, such as Speaker Deck or YouTube.

## Automatic deployment

AWS Amplify Hosting builds and deploys commits pushed to the GitHub `main`
branch. A local commit must be pushed to GitHub to trigger deployment.
The build settings are versioned in `amplify.yml`: install dependencies with
`npm ci`, run `npm run build`, and publish the `public` directory. Link metadata
is cached between builds. Build errors fail deployment to avoid publishing an
incomplete site.

Hosting uses the `danilop-personal-page` Amplify app (`d26ru7a9pi36wa`) in
`eu-west-1`, with `danilop.net` and `www.danilop.net` mapped to `main`.
Automatic builds must remain enabled for that branch in Amplify. The GitHub
push webhook triggers Amplify directly; no GitHub Actions deployment workflow
or AWS credentials in GitHub are required.
