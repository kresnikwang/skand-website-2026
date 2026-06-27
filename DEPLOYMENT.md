# SKAND Website Deployment

This server is managed by 1Panel OpenResty running in Docker.

## Live Server

- Host: `123.57.167.97`
- SSH user: `root`
- Public site: `https://skandstudio.com/`
- B-side page: `https://skandstudio.com/b-side.html`

## Important Paths

Deploy only to the 1Panel website root:

```bash
/opt/1panel/www/wwwroot/www.skandstudio.com
```

Inside the OpenResty container this path is mounted as:

```bash
/www/wwwroot/www.skandstudio.com
```

Do not deploy to the old host-side mirror path unless it is a symlink:

```bash
/www/wwwroot/www.skandstudio.com
```

## OpenResty Commands

The live service is the Docker container `1Panel-openresty-hoTG`, not the host `nginx.service`.

```bash
docker exec 1Panel-openresty-hoTG nginx -t
docker exec 1Panel-openresty-hoTG nginx -s reload
```

## Deploy Command

From this project root:

```bash
rsync -az --delete \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='.DS_Store' \
  --exclude='.workbuddy/' \
  --exclude='README.md' \
  --exclude='download-fonts.py' \
  --exclude='package.json' \
  --exclude='package-lock.json' \
  --exclude='test_ssh.exp' \
  ./ root@123.57.167.97:/opt/1panel/www/wwwroot/www.skandstudio.com/
```

Static HTML/CSS/images/fonts take effect immediately. Reload OpenResty only after config changes.
