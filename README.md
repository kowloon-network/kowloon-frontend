# Kowloon web frontend

The web app for [Kowloon](https://kowloon.network), a small, open-source social network made of independent communities. It's what members see in a browser: the feed, the composer, circles, groups, profiles, and the admin panel.

It's a React app built with Vite. It talks to a Kowloon server only through [`@kowloon/client`](https://github.com/kowloon-network/kowloon-client).

**Documentation: <https://kowloon.network/docs/>**

## Running Kowloon

You don't need this repository to run a server. The server's Docker image already includes a built copy of this frontend; see [Installing Kowloon](https://kowloon.network/docs/admin/install/).

## Developing

This repository expects two sibling checkouts beside it, because it installs them from `../client` and `../design`:

```
kowloon/
  client/     https://github.com/kowloon-network/kowloon-client
  design/     https://github.com/kowloon-network/kowloon-design
  frontend/   this repository
```

You also need Node.js 22 and a Kowloon server to talk to -- a local one (see the [server README](https://github.com/kowloon-network/kowloon#developing)) or one you have an account on.

```bash
npm install
cp .env.example .env.local
```

In `.env.local`, set `VITE_SERVER_URL` to your server, for example `http://localhost:3000`. Left blank, the sign-in page asks which server to use.

```bash
npm run dev       # development server on http://localhost:5173
npm run build     # production build in dist/
npm run lint
```

`npm run dev` and `npm run build` first generate the theme colours from the shared palette in `../design`.

A server running with `NODE_ENV=production` refuses browser requests from `localhost:5173` unless you add that address to its `CORS_ORIGIN` setting.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before you start, and follow the [Code of Conduct](CODE_OF_CONDUCT.md). To report a security problem, see [SECURITY.md](SECURITY.md) -- please don't open a public issue.

## Licence

Licensed under the [Apache License, Version 2.0](LICENSE).

You may use, modify and redistribute this software, including commercially
and in closed-source products, provided you retain the copyright and licence
notices, state any changes you made, and include the `NOTICE` file. The
licence also grants an explicit patent licence from contributors, which
terminates for anyone who brings a patent claim against the project.
