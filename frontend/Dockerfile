FROM node:22-alpine

WORKDIR /app

# El npm que trae node:22-alpine (10.x) rechaza este lockfile con un falso
# EUSAGE ("Missing: @floating-ui/dom from lock file") que npm 11 no tiene --
# mismatch de version de npm, no del lockfile (que si es valido: `npm ci`
# funciona en local con npm 11). Se sube npm antes de instalar para no
# depender de que versión de npm trae cada imagen base.
RUN npm install -g npm@11.6.2

# Capa de dependencias aparte: solo se invalida cuando cambia package-lock.json.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
