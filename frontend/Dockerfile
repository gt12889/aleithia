FROM node:22-slim

WORKDIR /app

COPY package.json ./
RUN npm install
RUN npm install @clerk/clerk-react @react-three/fiber @react-three/drei

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev"]
