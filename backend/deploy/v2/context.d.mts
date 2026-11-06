export const repo:string,owner:string,branch:string,entry:string,origin:string,project:string;
export function requireValue(ok:unknown,code:string):asserts ok;
export function controllerContext(e:NodeJS.ProcessEnv):boolean;
export function requireController(e:NodeJS.ProcessEnv):void;
export function environmentProtection(value:any,name:string):void;
export function branchProtection(rules:any[],sets:any[]):void;
