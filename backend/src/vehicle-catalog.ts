// A maintained starting catalogue, supplemented by company-scoped, audited entries.
// Display strings do not replace historical vehicle identities or saved names.
export const vehicleCatalogue:Record<string,string[]>={
 Toyota:['Hilux','Corolla','Camry','Yaris','Land Cruiser','Prado','Fortuner','RAV4','Hiace','Coaster','Dyna','Avalon','Innova','Rush','Raize','Supra','Crown'],
 Nissan:['Patrol','Sunny','Altima','Maxima','Sentra','Kicks','X-Trail','Pathfinder','Navara','Urvan','Civilian','Pickup','Armada','Juke','Murano','Z'],
 Mitsubishi:['L200','Pajero','Montero Sport','Outlander','ASX','Attrage','Lancer','Canter','Fuso Rosa','Fuso Fighter'],
 Isuzu:['D-Max','MU-X','N-Series','F-Series','Giga','Journey'],Hino:['300','500','700','Dutro','Ranger','Profia'],
 'Mercedes-Benz':['Actros','Arocs','Atego','Sprinter','Vito','C-Class','E-Class','S-Class','GLC','GLE','GLS','G-Class','Tourismo','Citaro'],
 Volvo:['FH','FM','FMX','FE','FL','XC40','XC60','XC90','S60','S90','V60','V90'],Scania:['P-Series','G-Series','R-Series','S-Series','K-Series'],MAN:['TGL','TGM','TGS','TGX','Lion’s Coach','Lion’s City'],
 Ford:['Ranger','F-150','F-250','Transit','Transit Custom','Explorer','Expedition','Everest','Territory','Mustang','Edge','Taurus'],
 Hyundai:['Accent','Elantra','Sonata','Azera','Tucson','Santa Fe','Palisade','Creta','Staria','H1','County','Mighty','Xcient','Porter','Ioniq 5','Ioniq 6'],
 Kia:['Picanto','Rio','Cerato','K3','K5','K8','K9','Seltos','Sportage','Sorento','Telluride','Carnival','Bongo','EV6','EV9'],
 Honda:['City','Civic','Accord','HR-V','CR-V','ZR-V','Pilot','Odyssey'],Mazda:['Mazda2','Mazda3','Mazda6','CX-3','CX-30','CX-5','CX-60','CX-9','CX-90','BT-50'],
 Suzuki:['Swift','Baleno','Ciaz','Dzire','Jimny','Vitara','Ertiga','Fronx','Carry'],Daihatsu:['Terios','Sirion','Gran Max','Hijet'],Subaru:['Impreza','Legacy','Forester','Outback','Crosstrek','WRX','BRZ'],
 Lexus:['IS','ES','LS','UX','NX','RX','GX','LX','LM'],Infiniti:['Q50','Q60','QX50','QX55','QX60','QX80'],Acura:['Integra','TLX','RDX','MDX'],
 BMW:['1 Series','2 Series','3 Series','4 Series','5 Series','7 Series','8 Series','X1','X2','X3','X4','X5','X6','X7','i4','i5','i7','iX'],Audi:['A3','A4','A5','A6','A7','A8','Q2','Q3','Q5','Q7','Q8','e-tron'],
 Volkswagen:['Golf','Polo','Passat','Jetta','Arteon','Tiguan','Touareg','Teramont','Caddy','Transporter','Crafter','Amarok'],Skoda:['Fabia','Octavia','Superb','Karoq','Kodiaq','Scala'],SEAT:['Ibiza','Leon','Ateca','Tarraco'],
 Peugeot:['208','308','408','508','2008','3008','5008','Partner','Expert','Boxer'],Renault:['Clio','Megane','Talisman','Captur','Duster','Koleos','Kangoo','Trafic','Master'],Citroen:['C3','C4','C5 Aircross','Berlingo','Jumpy','Jumper'],
 Fiat:['500','Tipo','Doblo','Ducato','Fiorino','Talento'],Iveco:['Daily','Eurocargo','S-Way','T-Way','Crossway'],DAF:['LF','CF','XF','XD','XG'],
 Chevrolet:['Spark','Aveo','Cruze','Malibu','Impala','Camaro','Corvette','Trax','Captiva','Equinox','Traverse','Blazer','Tahoe','Suburban','Silverado','Express'],
 GMC:['Terrain','Acadia','Yukon','Sierra','Savana'],Cadillac:['CT4','CT5','XT4','XT5','XT6','Escalade','Lyriq'],Buick:['Encore','Envision','Enclave'],
 Jeep:['Wrangler','Grand Cherokee','Cherokee','Compass','Renegade','Gladiator'],Dodge:['Charger','Challenger','Durango','Journey','Ram'],Ram:['1500','2500','3500','ProMaster'],Chrysler:['300','Pacifica','Voyager'],Lincoln:['Corsair','Nautilus','Aviator','Navigator'],
 'Land Rover':['Defender','Discovery','Discovery Sport','Range Rover','Range Rover Sport','Range Rover Velar','Range Rover Evoque'],Jaguar:['XE','XF','F-Pace','E-Pace','I-Pace','F-Type'],Mini:['Cooper','Clubman','Countryman'],
 Porsche:['911','718','Panamera','Macan','Cayenne','Taycan'],Bentley:['Continental GT','Flying Spur','Bentayga'],'Rolls-Royce':['Ghost','Phantom','Cullinan','Spectre'],Ferrari:['Roma','Portofino','296','SF90','Purosangue'],Lamborghini:['Huracan','Aventador','Urus','Revuelto'],Maserati:['Ghibli','Quattroporte','Levante','Grecale','MC20'],
 Tesla:['Model S','Model 3','Model X','Model Y','Cybertruck'],BYD:['Atto 3','Dolphin','Seal','Han','Tang','Song Plus','Qin Plus','Seagull'],MG:['3','5','6','7','ZS','HS','RX5','RX8','One','4','Cyberster'],Geely:['Emgrand','Coolray','Tugella','Monjaro','Okavango','Geometry C'],
 Changan:['Alsvin','Eado','UNI-V','UNI-T','UNI-K','CS35 Plus','CS55 Plus','CS75 Plus','CS95','Hunter'],Chery:['Arrizo 5','Arrizo 6','Arrizo 8','Tiggo 2','Tiggo 4','Tiggo 7','Tiggo 8','Tiggo 9'],Haval:['Jolion','H6','H9','Dargo'],GWM:['Poer','Wingle 5','Wingle 7'],Tank:['300','500','700'],JAC:['J7','JS3','JS4','JS6','T6','T8','Sunray','N-Series'],
 Foton:['Tunland','View','Toano','Aumark','Auman'],Dongfeng:['Rich','AX7','Aeolus','Captain','Dolphin'],FAW:['J6','J7','Tiger','V2'],Tata:['Ace','Super Ace','Xenon','Prima','Ultra','Starbus'],AshokLeyland:['Dost','Partner','Boss','Falcon','Oyster'],Mahindra:['Scorpio','XUV700','Thar','Bolero','Pik Up'],UD:['Quester','Croner','Quon'],
 KingLong:['XMQ6127','XMQ6110','XMQ6900'],Yutong:['ZK6122','ZK6118','ZK6858'],GoldenDragon:['XML6125','XML6102','XML6700'],
 Ducati:['Monster','Multistrada','Panigale','Scrambler'],Yamaha:['YBR125','FZ','MT-07','MT-09','NMAX','TMAX'],Kawasaki:['Ninja','Z650','Z900','Versys'],Bajaj:['Boxer','Pulsar','Dominar'],TVS:['Apache','HLX','Jupiter']
};
export function catalogueWith(additions:any[]=[]){const result:Record<string,string[]>=Object.create(null);for(const [make,models] of Object.entries(vehicleCatalogue))result[make]=[...models];for(const entry of additions){const make=Object.keys(result).find(k=>k.toLocaleLowerCase()===entry.make.toLocaleLowerCase())||entry.make;result[make]||=[];if(!result[make].some(m=>m.toLocaleLowerCase()===entry.model.toLocaleLowerCase()))result[make].push(entry.model);}return result;}
