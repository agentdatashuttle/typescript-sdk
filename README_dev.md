## For making a version update

1. Update version in `package.json`
2. Build and push to NPM
   > Run `npm run push`
   > This triggers `tsup` to build the TS project with custom settings and support for both CommonJS and ESM
