import { readFileSync } from 'fs';

type Config = {
	features: {
		verification: {
			enabled: boolean;
			types: string[];
		};
		age_verification: {
			enabled: boolean;
		};
	};
};

export const config: Config = JSON.parse(
	readFileSync('./config.json').toString()
);
