<p align="center">
<img src="https://raw.githubusercontent.com/Nexirift/.github/main/banner.svg" width="300" />
</p>

# Spark

Spark: the API server for Nexirift. Please see the [Disclaimer](#disclaimer)
before using.

## Disclaimer

This is a recode of the original internal Spark server. Even though this is a
second revision, it is still not ideal for production use (but has less messy
code than the first revision). Only use it once we deem that it is production
ready (aka: when Nexirift publicly releases). By running this software in
production, you understand the risks.

## Installation

### Prerequisites

-   [KeyDB](https://docs.keydb.dev/docs)
    -   Or a Redis compatible client, we no longer recommend official Redis.
    -   If you would like to know why we don't suggest it, read the comments
        [here](https://github.com/redis/redis/pull/13157).
-   [Authentik](https://goauthentik.io)

_psst: see our Authentik stuff [here](https://github.com/Nexirift/authentik)._

### Instructions

Our documentation website is still a work in progress, but you might find better
success with guides on there as they should be updated regularly. You can visit
that [here](https://docs.nexirift.com).

#### Standard (Development)

0. Set up the prerequistes first.
1. Clone the project by using Git:
   `git clone https://github.com/Nexirift/spark`.
2. Install packages using bun: `bun install`.
3. Start the server using: `bun dev`.
4. Configure the `.env` values to fit your needs.
5. Use a tool like Insomnia to send a GQL request!

#### Docker ("Production")

_There is no public docker image (for now), so you have to build it yourself._

0. Have docker and docker compose set up.
1. Clone the project by using Git:
   `git clone https://github.com/Nexirift/spark`.
2. Run the stack by doing `docker compose up -d`.
    - This _should_ auto build the image.

### OIDC Link

You can fill in these values to login to an authentication provider, such as
Authentik:

```
http://authentik.local/application/o/authorize/?
client_id=clientidgoeshere
&redirect_uri= https://openidconnect.net/callback
&scope=openid profile email
&response_type=code
```

## License

[GPL-3.0](/LICENSE)
