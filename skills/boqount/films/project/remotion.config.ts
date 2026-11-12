import {Config} from '@remotion/cli/config';

Config.setRspack(true);
Config.setVideoImageFormat('png');
Config.setColorSpace('bt709'); // Remotion 4 defaults to bt601; every file here is bt709.
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);
