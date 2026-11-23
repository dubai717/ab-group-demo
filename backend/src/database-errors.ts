// Server database failures are not input errors. No provider messages or connection values are reflected.
export function databaseServiceFailure(error:unknown){const code=(error as{code?:unknown})?.code;return typeof code==='string'&&/^[0-9A-Z]{5}$/.test(code)&&(/^(08|53|54|57|58|XX)/.test(code)||['40001','40P01','42P01','42703','42883'].includes(code));}
