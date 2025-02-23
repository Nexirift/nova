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
- Local NPM registry

#### For Database

- Docker v27.5.1 or greater
- Docker Compose v2.32.4 or greater

*These prerequisites are based on the versions that we are using.*

### Local NPM Registry

Our internal packages are not hosted on the public NPM registry, such as `@nexirift/db`. To use our internal projects, you will need to set up a local NPM registry. During our testing, we noticed that Next.js and shadcn/ui don't like Bun's linked packages.

1. Install Verdaccio: `bun i -g verdaccio`
2. Start the Verdaccio server locally: `verdaccio`
3. Create an account: `bunx npm adduser --registry http://localhost:4873`
    - Example: `developer` | `P@ssw0rd` | `developer@nexirift.com`
4. Clone any `@nexirift/*` packages using Git
5. Run `bun publish` on the cloned repositories

*More information: https://verdaccio.org/docs/setup-bun*

### Installation

1. Clone the repository: `git clone https://github.com/Nexirift/nova.git`
2. Install dependencies with `bun install`
3. Start the database using `bun db:start`
4. Migrate the database using `bun db:all`
5. You can start the dev server using `bun dev`

## Disclaimer

This software is currently in development and should not be used in production until the official Nexirift public release. By deploying this software in a production environment, you acknowledge and accept all associated risks. Please wait for production-ready status before implementation.

## License

Nexirift's internal projects are licensed under the [GNU General Public License v3.0](LICENSE).
