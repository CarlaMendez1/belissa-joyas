import pg from 'pg';

// La base guarda las fechas (columnas "timestamp" sin zona) en hora UTC, pero el driver las
// leía como hora local del servidor y las mostraba corridas 3 horas en Argentina.
// Con esto, todas las fechas se leen y se escriben como UTC y el navegador las muestra bien.
pg.types.setTypeParser(1114, (valor: string) => new Date(`${valor.replace(' ', 'T')}Z`));
pg.defaults.parseInputDatesAsUTC = true;
