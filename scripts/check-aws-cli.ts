import { checkAwsCli } from "../core/aws-cli";
checkAwsCli()
  .then((version) => {
    console.log(
      `AWS CLI ${version}: compatible. Dependency check only; no AWS requests or credential changes.`,
    );
  })
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
