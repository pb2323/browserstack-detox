// @ts-nocheck
const _ = require('lodash');

const package_json = require('../../package.json');
const DetoxConfigErrorComposer = require('../errors/DetoxConfigErrorComposer');

const collectCliConfig = require('./collectCliConfig');
const composeAppsConfig = require('./composeAppsConfig');
const composeArtifactsConfig = require('./composeArtifactsConfig');
const composeBehaviorConfig = require('./composeBehaviorConfig');
const composeDeviceConfig = require('./composeDeviceConfig');
const composeLoggerConfig = require('./composeLoggerConfig');
const composeRunnerConfig = require('./composeRunnerConfig');
const composeSessionConfig = require('./composeSessionConfig');
const loadExternalConfig = require('./loadExternalConfig');
const selectConfiguration = require('./selectConfiguration');
const validateCloudAuthConfig = require('./validateCloudAuthConfig');

async function composeDetoxConfig({
  cwd = process.cwd(),
  argv = undefined,
  testRunnerArgv = undefined,
  errorComposer = new DetoxConfigErrorComposer(),
  override = undefined,
}) {
  const cliConfig = collectCliConfig({ argv });
  const findupResult = await loadExternalConfig({
    errorComposer,
    configPath: cliConfig.configPath,
    cwd,
  });

  const externalConfig = findupResult && findupResult.config;
  errorComposer.setDetoxConfigPath(findupResult && findupResult.filepath);
  errorComposer.setDetoxConfig(externalConfig);

  /** @type {Detox.DetoxConfig} */
  const globalConfig = _.merge({}, externalConfig, override);
  if (_.isEmpty(globalConfig) && !externalConfig) {
    // Advise to create .detoxrc somewhere
    throw errorComposer.noConfigurationSpecified();
  }
  errorComposer.setDetoxConfig(globalConfig);

  const { configurations } = globalConfig;

  const configurationName = selectConfiguration({
    errorComposer,
    globalConfig,
    cliConfig,
  });

  const localConfig = configurations[configurationName];

  if (localConfig['type']) {
    throw errorComposer.configurationShouldNotUseLegacyFormat();
  }

  const runnerConfig = composeRunnerConfig({
    globalConfig,
    localConfig,
    cliConfig,
    testRunnerArgv,
    errorComposer,
  });

  const deviceConfig = composeDeviceConfig({
    errorComposer,
    globalConfig,
    localConfig,
    cliConfig,
  });

  const appsConfig = composeAppsConfig({
    errorComposer,
    configurationName,
    deviceConfig,
    globalConfig,
    localConfig,
    cliConfig,
  });

  const artifactsConfig = composeArtifactsConfig({
    configurationName,
    globalConfig,
    localConfig,
    cliConfig,
  });

  const behaviorConfig = composeBehaviorConfig({
    globalConfig,
    localConfig,
    cliConfig,
    configurationName
  });

  const loggerConfig = composeLoggerConfig({
    globalConfig,
    localConfig,
    cliConfig,
  });

  const sessionConfig = await composeSessionConfig({
    errorComposer,
    globalConfig,
    localConfig,
    cliConfig,
    configurationName
  });

  const cloudAuthenticationConfig = await validateCloudAuthConfig({
    errorComposer,
    localConfig,
    configurationName
  });

  if (configurationName === 'android.cloud.release') {
    const query_param = {
      'apps': appsConfig,
      'device': deviceConfig,
      'artifacts': artifactsConfig,
      'session': sessionConfig,
      'cloudAuthentication': cloudAuthenticationConfig,
      'client.detoxVersion': package_json.version
    };
    sessionConfig.server += `?caps=${JSON.stringify(query_param)}`;
  }
  const result = {
    configurationName,

    apps: appsConfig,
    artifacts: artifactsConfig,
    behavior: behaviorConfig,
    cli: cliConfig,
    device: deviceConfig,
    logger: loggerConfig,
    testRunner: runnerConfig,
    session: sessionConfig,
    cloudAuthenticationConfig
  };

  Object.defineProperty(result, 'errorComposer', {
    enumerable: false,
    value: errorComposer,
  });

  return result;
}

module.exports = {
  composeDetoxConfig,
};
