import * as fs from "fs/promises";
import * as rimraf from "rimraf";

const generateServiceMocks = async (outputPath: string, services: string[]) => {
    await rimraf.rimraf(outputPath);
    await fs.mkdir(`${outputPath}/src`, {recursive: true});
    for (const service of services) {
        await fs.mkdir(`${outputPath}/src/${service.toLowerCase()}`);
        await generateApi(outputPath, service);
    }
    await generateApp(outputPath, services);
    await fs.copyFile("templates/package.json", `${outputPath}/package.json`);
    await fs.copyFile("templates/tsconfig.json", `${outputPath}/tsconfig.json`);
};

const generateImports = (services: string[]) => {
    let imports = [];
    let mapCalls = [];
    for (const service of services) {
        const mapFunction = `map${uppercaseFirstLetter(service)}`;
        imports.push(`import { ${mapFunction} } from "./${service}/api";`);
        mapCalls.push(`${mapFunction}(app);`);
    };
    return {
        imports,
        mapCalls
    };
};

const uppercaseFirstLetter = (s: string) => `${s.toUpperCase()[0]}${s.toLowerCase().substring(1)}`;

const generateApp = async (outputPath: string, services: string[]) => {
    const template = await fs.readFile("templates/src/app.ts", {encoding: 'utf-8'});
    const { imports, mapCalls } = generateImports(services);
    let content = template
        .replaceAll("// %IMPORT_APIS%", imports.join("\n"))
        .replaceAll("// %MAP_APIS%", mapCalls.join("\n"));
    await fs.writeFile(`${outputPath}/src/app.ts`, content, {encoding: 'utf-8'});
};

const generateApi = async (outputPath: string, service: string) => {
    const content = `
    import { Express } from "express";

    export const map${uppercaseFirstLetter(service)} = (app: Express) => {
        ${generateRoutes()}
    };
    `;
    await fs.writeFile(`${outputPath}/src/${service.toLowerCase()}/api.ts`, content, { encoding: 'utf-8' });
};

const generateRoutes = () => "app.post(...);";

await generateServiceMocks("output", ["email", "chat"]);
