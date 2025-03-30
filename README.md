<p align="center">
<img src="https://raw.githubusercontent.com/Nexirift/media-kit/main/nexirift/banner.svg" width="600" />
</p>

# Nova

Nova is the core API server for Nexirift.

## Getting Started (Development)

### Prerequisites

- Redis compatible server
- Node.js v22.13.0 or greater
- Bun v1.2.2 or greater
- Read the [contributing guide](https://github.com/Nexirift/.github/blob/main/contributing/README.md)

#### For Database

- Docker v27.5.1 or greater
- Docker Compose v2.32.4 or greater

*These prerequisites are based on the versions that we are using.*

### Installation

1. Clone the repository: `git clone https://github.com/Nexirift/nova.git`
2. Install dependencies with `bun install`
3. Start the database using `bun db:start`
4. Migrate the database using `bun db:all`
5. You can start the dev server using `bun dev`

## Disclaimer

This software is currently in development and should not be used in production until the official Nexirift public release. By deploying this software in a production environment, you acknowledge and accept all associated risks. Please wait for production-ready status before implementation.

## License

Nexirift's internal projects are licensed under the [GNU Affero General Public License v3.0](LICENSE).
