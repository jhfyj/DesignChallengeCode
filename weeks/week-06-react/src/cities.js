// The places the New dialog can suggest: city | country | IANA time zone |
// latitude | longitude. Hand-picked rather than pulled from a gazetteer -- a
// few hundred cities people actually travel to, roughly most-visited first,
// which is also the order suggestions come back in. To add one, add a line.
const DATA = `
New York|USA|America/New_York|40.71|-74.01
London|United Kingdom|Europe/London|51.51|-0.13
Paris|France|Europe/Paris|48.86|2.35
Tokyo|Japan|Asia/Tokyo|35.68|139.69
Bangkok|Thailand|Asia/Bangkok|13.76|100.5
Dubai|United Arab Emirates|Asia/Dubai|25.2|55.27
Singapore|Singapore|Asia/Singapore|1.35|103.82
Hong Kong|China|Asia/Hong_Kong|22.32|114.17
Istanbul|Turkey|Europe/Istanbul|41.01|28.98
Rome|Italy|Europe/Rome|41.9|12.5
Barcelona|Spain|Europe/Madrid|41.39|2.17
Amsterdam|Netherlands|Europe/Amsterdam|52.37|4.9
Los Angeles|USA|America/Los_Angeles|34.05|-118.24
Seoul|South Korea|Asia/Seoul|37.57|126.98
Shanghai|China|Asia/Shanghai|31.23|121.47
Beijing|China|Asia/Shanghai|39.9|116.41
Chengdu|China|Asia/Shanghai|30.57|104.07
Chongqing|China|Asia/Shanghai|29.56|106.55
Guangzhou|China|Asia/Shanghai|23.13|113.26
Shenzhen|China|Asia/Shanghai|22.54|114.06
Hangzhou|China|Asia/Shanghai|30.27|120.16
Xi'an|China|Asia/Shanghai|34.34|108.94
Nanjing|China|Asia/Shanghai|32.06|118.8
Suzhou|China|Asia/Shanghai|31.3|120.59
Wuhan|China|Asia/Shanghai|30.59|114.31
Kunming|China|Asia/Shanghai|25.04|102.71
Xiamen|China|Asia/Shanghai|24.48|118.09
Qingdao|China|Asia/Shanghai|36.07|120.38
Tianjin|China|Asia/Shanghai|39.34|117.36
Changsha|China|Asia/Shanghai|28.23|112.94
Harbin|China|Asia/Shanghai|45.8|126.53
Lhasa|China|Asia/Shanghai|29.65|91.17
Guilin|China|Asia/Shanghai|25.27|110.29
Sanya|China|Asia/Shanghai|18.25|109.51
Macau|China|Asia/Macau|22.2|113.54
Taipei|Taiwan|Asia/Taipei|25.03|121.57
Kaohsiung|Taiwan|Asia/Taipei|22.63|120.3
Osaka|Japan|Asia/Tokyo|34.69|135.5
Kyoto|Japan|Asia/Tokyo|35.01|135.77
Ginza|Japan|Asia/Tokyo|35.67|139.77
Shibuya|Japan|Asia/Tokyo|35.66|139.7
Yokohama|Japan|Asia/Tokyo|35.44|139.64
Nara|Japan|Asia/Tokyo|34.69|135.8
Sapporo|Japan|Asia/Tokyo|43.06|141.35
Fukuoka|Japan|Asia/Tokyo|33.59|130.4
Hiroshima|Japan|Asia/Tokyo|34.39|132.46
Nagoya|Japan|Asia/Tokyo|35.18|136.91
Okinawa|Japan|Asia/Tokyo|26.21|127.68
Busan|South Korea|Asia/Seoul|35.18|129.08
Jeju|South Korea|Asia/Seoul|33.5|126.53
Kuala Lumpur|Malaysia|Asia/Kuala_Lumpur|3.14|101.69
Penang|Malaysia|Asia/Kuala_Lumpur|5.41|100.33
Bali|Indonesia|Asia/Makassar|-8.34|115.09
Jakarta|Indonesia|Asia/Jakarta|-6.21|106.85
Manila|Philippines|Asia/Manila|14.6|120.98
Ho Chi Minh City|Vietnam|Asia/Ho_Chi_Minh|10.82|106.63
Hanoi|Vietnam|Asia/Bangkok|21.03|105.85
Da Nang|Vietnam|Asia/Ho_Chi_Minh|16.05|108.2
Hoi An|Vietnam|Asia/Ho_Chi_Minh|15.88|108.33
Phuket|Thailand|Asia/Bangkok|7.88|98.39
Chiang Mai|Thailand|Asia/Bangkok|18.79|98.98
Siem Reap|Cambodia|Asia/Phnom_Penh|13.36|103.86
Phnom Penh|Cambodia|Asia/Phnom_Penh|11.56|104.92
Luang Prabang|Laos|Asia/Vientiane|19.89|102.13
Yangon|Myanmar|Asia/Yangon|16.87|96.2
Delhi|India|Asia/Kolkata|28.61|77.21
Mumbai|India|Asia/Kolkata|19.08|72.88
Bangalore|India|Asia/Kolkata|12.97|77.59
Jaipur|India|Asia/Kolkata|26.91|75.79
Agra|India|Asia/Kolkata|27.18|78.01
Goa|India|Asia/Kolkata|15.3|74.12
Kolkata|India|Asia/Kolkata|22.57|88.36
Chennai|India|Asia/Kolkata|13.08|80.27
Kathmandu|Nepal|Asia/Kathmandu|27.72|85.32
Colombo|Sri Lanka|Asia/Colombo|6.93|79.86
Malé|Maldives|Indian/Maldives|4.18|73.51
Doha|Qatar|Asia/Qatar|25.29|51.53
Abu Dhabi|United Arab Emirates|Asia/Dubai|24.45|54.38
Riyadh|Saudi Arabia|Asia/Riyadh|24.71|46.68
Muscat|Oman|Asia/Muscat|23.59|58.41
Tel Aviv|Israel|Asia/Jerusalem|32.09|34.78
Jerusalem|Israel|Asia/Jerusalem|31.77|35.21
Amman|Jordan|Asia/Amman|31.95|35.93
Petra|Jordan|Asia/Amman|30.33|35.44
Beirut|Lebanon|Asia/Beirut|33.89|35.5
Tbilisi|Georgia|Asia/Tbilisi|41.72|44.79
Baku|Azerbaijan|Asia/Baku|40.41|49.87
Yerevan|Armenia|Asia/Yerevan|40.18|44.51
Almaty|Kazakhstan|Asia/Almaty|43.24|76.89
Tashkent|Uzbekistan|Asia/Tashkent|41.3|69.24
Samarkand|Uzbekistan|Asia/Samarkand|39.65|66.96
Ulaanbaatar|Mongolia|Asia/Ulaanbaatar|47.89|106.91
Sydney|Australia|Australia/Sydney|-33.87|151.21
Melbourne|Australia|Australia/Melbourne|-37.81|144.96
Brisbane|Australia|Australia/Brisbane|-27.47|153.03
Perth|Australia|Australia/Perth|-31.95|115.86
Adelaide|Australia|Australia/Adelaide|-34.93|138.6
Cairns|Australia|Australia/Brisbane|-16.92|145.77
Gold Coast|Australia|Australia/Brisbane|-28.02|153.4
Hobart|Australia|Australia/Hobart|-42.88|147.33
Auckland|New Zealand|Pacific/Auckland|-36.85|174.76
Wellington|New Zealand|Pacific/Auckland|-41.29|174.78
Queenstown|New Zealand|Pacific/Auckland|-45.03|168.66
Christchurch|New Zealand|Pacific/Auckland|-43.53|172.64
Fiji|Fiji|Pacific/Fiji|-17.71|178.07
Honolulu|USA|Pacific/Honolulu|21.31|-157.86
Maui|USA|Pacific/Honolulu|20.8|-156.33
San Francisco|USA|America/Los_Angeles|37.77|-122.42
San Diego|USA|America/Los_Angeles|32.72|-117.16
San Jose|USA|America/Los_Angeles|37.34|-121.89
Seattle|USA|America/Los_Angeles|47.61|-122.33
Portland|USA|America/Los_Angeles|45.52|-122.68
Las Vegas|USA|America/Los_Angeles|36.17|-115.14
Palm Springs|USA|America/Los_Angeles|33.83|-116.55
Phoenix|USA|America/Phoenix|33.45|-112.07
Sedona|USA|America/Phoenix|34.87|-111.76
Denver|USA|America/Denver|39.74|-104.99
Salt Lake City|USA|America/Denver|40.76|-111.89
Santa Fe|USA|America/Denver|35.69|-105.94
Chicago|USA|America/Chicago|41.88|-87.63
Austin|USA|America/Chicago|30.27|-97.74
Houston|USA|America/Chicago|29.76|-95.37
Dallas|USA|America/Chicago|32.78|-96.8
San Antonio|USA|America/Chicago|29.42|-98.49
New Orleans|USA|America/Chicago|29.95|-90.07
Nashville|USA|America/Chicago|36.16|-86.78
Minneapolis|USA|America/Chicago|44.98|-93.27
St. Louis|USA|America/Chicago|38.63|-90.2
Kansas City|USA|America/Chicago|39.1|-94.58
Boston|USA|America/New_York|42.36|-71.06
Washington, D.C.|USA|America/New_York|38.91|-77.04
Philadelphia|USA|America/New_York|39.95|-75.17
Brooklyn|USA|America/New_York|40.68|-73.94
Miami|USA|America/New_York|25.76|-80.19
Orlando|USA|America/New_York|28.54|-81.38
Atlanta|USA|America/New_York|33.75|-84.39
Charleston|USA|America/New_York|32.78|-79.93
Savannah|USA|America/New_York|32.08|-81.09
Pittsburgh|USA|America/New_York|40.44|-80
Baltimore|USA|America/New_York|39.29|-76.61
Detroit|USA|America/Detroit|42.33|-83.05
Providence|USA|America/New_York|41.82|-71.41
Portland, Maine|USA|America/New_York|43.66|-70.26
Burlington|USA|America/New_York|44.48|-73.21
Key West|USA|America/New_York|24.56|-81.78
Anchorage|USA|America/Anchorage|61.22|-149.9
Toronto|Canada|America/Toronto|43.65|-79.38
Montreal|Canada|America/Toronto|45.5|-73.57
Vancouver|Canada|America/Vancouver|49.28|-123.12
Quebec City|Canada|America/Toronto|46.81|-71.21
Ottawa|Canada|America/Toronto|45.42|-75.7
Calgary|Canada|America/Edmonton|51.05|-114.07
Banff|Canada|America/Edmonton|51.18|-115.57
Victoria|Canada|America/Vancouver|48.43|-123.37
Halifax|Canada|America/Halifax|44.65|-63.58
Mexico City|Mexico|America/Mexico_City|19.43|-99.13
Cancún|Mexico|America/Cancun|21.16|-86.85
Tulum|Mexico|America/Cancun|20.21|-87.47
Oaxaca|Mexico|America/Mexico_City|17.07|-96.73
Guadalajara|Mexico|America/Mexico_City|20.66|-103.35
Puerto Vallarta|Mexico|America/Mexico_City|20.65|-105.23
Cabo San Lucas|Mexico|America/Mazatlan|22.89|-109.92
Havana|Cuba|America/Havana|23.11|-82.37
San Juan|Puerto Rico|America/Puerto_Rico|18.47|-66.11
Nassau|Bahamas|America/Nassau|25.04|-77.35
Montego Bay|Jamaica|America/Jamaica|18.47|-77.92
Punta Cana|Dominican Republic|America/Santo_Domingo|18.58|-68.4
San José|Costa Rica|America/Costa_Rica|9.93|-84.08
Panama City|Panama|America/Panama|8.98|-79.52
Antigua|Guatemala|America/Guatemala|14.56|-90.73
Cartagena|Colombia|America/Bogota|10.39|-75.48
Bogotá|Colombia|America/Bogota|4.71|-74.07
Medellín|Colombia|America/Bogota|6.24|-75.58
Quito|Ecuador|America/Guayaquil|-0.18|-78.47
Lima|Peru|America/Lima|-12.05|-77.04
Cusco|Peru|America/Lima|-13.53|-71.97
La Paz|Bolivia|America/La_Paz|-16.5|-68.15
Santiago|Chile|America/Santiago|-33.45|-70.67
Valparaíso|Chile|America/Santiago|-33.05|-71.62
Buenos Aires|Argentina|America/Argentina/Buenos_Aires|-34.6|-58.38
Mendoza|Argentina|America/Argentina/Mendoza|-32.89|-68.84
Ushuaia|Argentina|America/Argentina/Ushuaia|-54.8|-68.3
Montevideo|Uruguay|America/Montevideo|-34.9|-56.16
Rio de Janeiro|Brazil|America/Sao_Paulo|-22.91|-43.17
São Paulo|Brazil|America/Sao_Paulo|-23.55|-46.63
Salvador|Brazil|America/Bahia|-12.97|-38.5
Florianópolis|Brazil|America/Sao_Paulo|-27.6|-48.55
Madrid|Spain|Europe/Madrid|40.42|-3.7
Seville|Spain|Europe/Madrid|37.39|-5.98
Granada|Spain|Europe/Madrid|37.18|-3.6
Valencia|Spain|Europe/Madrid|39.47|-0.38
Málaga|Spain|Europe/Madrid|36.72|-4.42
Bilbao|Spain|Europe/Madrid|43.26|-2.93
San Sebastián|Spain|Europe/Madrid|43.32|-1.98
Palma|Spain|Europe/Madrid|39.57|2.65
Ibiza|Spain|Europe/Madrid|38.91|1.43
Tenerife|Spain|Atlantic/Canary|28.29|-16.63
Lisbon|Portugal|Europe/Lisbon|38.72|-9.14
Porto|Portugal|Europe/Lisbon|41.15|-8.61
Lagos|Portugal|Europe/Lisbon|37.1|-8.67
Funchal|Portugal|Atlantic/Madeira|32.65|-16.91
Nice|France|Europe/Paris|43.7|7.27
Lyon|France|Europe/Paris|45.76|4.84
Marseille|France|Europe/Paris|43.3|5.37
Bordeaux|France|Europe/Paris|44.84|-0.58
Strasbourg|France|Europe/Paris|48.57|7.75
Cannes|France|Europe/Paris|43.55|7.01
Annecy|France|Europe/Paris|45.9|6.13
Monaco|Monaco|Europe/Monaco|43.74|7.42
Milan|Italy|Europe/Rome|45.46|9.19
Venice|Italy|Europe/Rome|45.44|12.32
Florence|Italy|Europe/Rome|43.77|11.26
Naples|Italy|Europe/Rome|40.85|14.27
Amalfi|Italy|Europe/Rome|40.63|14.6
Positano|Italy|Europe/Rome|40.63|14.48
Capri|Italy|Europe/Rome|40.55|14.24
Turin|Italy|Europe/Rome|45.07|7.69
Bologna|Italy|Europe/Rome|44.49|11.34
Verona|Italy|Europe/Rome|45.44|10.99
Lake Como|Italy|Europe/Rome|46.02|9.26
Cinque Terre|Italy|Europe/Rome|44.13|9.71
Pisa|Italy|Europe/Rome|43.72|10.4
Siena|Italy|Europe/Rome|43.32|11.33
Palermo|Italy|Europe/Rome|38.12|13.36
Sardinia|Italy|Europe/Rome|40.12|9.01
Vatican City|Vatican City|Europe/Vatican|41.9|12.45
Berlin|Germany|Europe/Berlin|52.52|13.4
Munich|Germany|Europe/Berlin|48.14|11.58
Frankfurt|Germany|Europe/Berlin|50.11|8.68
Hamburg|Germany|Europe/Berlin|53.55|9.99
Cologne|Germany|Europe/Berlin|50.94|6.96
Düsseldorf|Germany|Europe/Berlin|51.23|6.77
Heidelberg|Germany|Europe/Berlin|49.4|8.67
Dresden|Germany|Europe/Berlin|51.05|13.74
Stuttgart|Germany|Europe/Berlin|48.78|9.18
Nuremberg|Germany|Europe/Berlin|49.45|11.08
Vienna|Austria|Europe/Vienna|48.21|16.37
Salzburg|Austria|Europe/Vienna|47.81|13.06
Innsbruck|Austria|Europe/Vienna|47.27|11.4
Hallstatt|Austria|Europe/Vienna|47.56|13.65
Zurich|Switzerland|Europe/Zurich|47.38|8.54
Geneva|Switzerland|Europe/Zurich|46.2|6.14
Lucerne|Switzerland|Europe/Zurich|47.05|8.31
Interlaken|Switzerland|Europe/Zurich|46.69|7.86
Zermatt|Switzerland|Europe/Zurich|46.02|7.75
Bern|Switzerland|Europe/Zurich|46.95|7.45
Brussels|Belgium|Europe/Brussels|50.85|4.35
Bruges|Belgium|Europe/Brussels|51.21|3.22
Antwerp|Belgium|Europe/Brussels|51.22|4.4
Ghent|Belgium|Europe/Brussels|51.05|3.72
Rotterdam|Netherlands|Europe/Amsterdam|51.92|4.48
The Hague|Netherlands|Europe/Amsterdam|52.07|4.3
Utrecht|Netherlands|Europe/Amsterdam|52.09|5.12
Luxembourg|Luxembourg|Europe/Luxembourg|49.61|6.13
Edinburgh|United Kingdom|Europe/London|55.95|-3.19
Glasgow|United Kingdom|Europe/London|55.86|-4.25
Manchester|United Kingdom|Europe/London|53.48|-2.24
Liverpool|United Kingdom|Europe/London|53.41|-2.98
Oxford|United Kingdom|Europe/London|51.75|-1.26
Cambridge|United Kingdom|Europe/London|52.21|0.12
Bath|United Kingdom|Europe/London|51.38|-2.36
Brighton|United Kingdom|Europe/London|50.82|-0.14
York|United Kingdom|Europe/London|53.96|-1.08
Belfast|United Kingdom|Europe/London|54.6|-5.93
Cardiff|United Kingdom|Europe/London|51.48|-3.18
Dublin|Ireland|Europe/Dublin|53.35|-6.26
Galway|Ireland|Europe/Dublin|53.27|-9.06
Cork|Ireland|Europe/Dublin|51.9|-8.47
Reykjavík|Iceland|Atlantic/Reykjavik|64.15|-21.94
Copenhagen|Denmark|Europe/Copenhagen|55.68|12.57
Stockholm|Sweden|Europe/Stockholm|59.33|18.07
Gothenburg|Sweden|Europe/Stockholm|57.71|11.97
Oslo|Norway|Europe/Oslo|59.91|10.75
Bergen|Norway|Europe/Oslo|60.39|5.32
Tromsø|Norway|Europe/Oslo|69.65|18.96
Helsinki|Finland|Europe/Helsinki|60.17|24.94
Rovaniemi|Finland|Europe/Helsinki|66.5|25.73
Tallinn|Estonia|Europe/Tallinn|59.44|24.75
Riga|Latvia|Europe/Riga|56.95|24.11
Vilnius|Lithuania|Europe/Vilnius|54.69|25.28
Prague|Czech Republic|Europe/Prague|50.08|14.44
Český Krumlov|Czech Republic|Europe/Prague|48.81|14.32
Budapest|Hungary|Europe/Budapest|47.5|19.04
Warsaw|Poland|Europe/Warsaw|52.23|21.01
Kraków|Poland|Europe/Warsaw|50.06|19.94
Gdańsk|Poland|Europe/Warsaw|54.35|18.65
Bratislava|Slovakia|Europe/Bratislava|48.15|17.11
Ljubljana|Slovenia|Europe/Ljubljana|46.06|14.51
Lake Bled|Slovenia|Europe/Ljubljana|46.36|14.09
Zagreb|Croatia|Europe/Zagreb|45.81|15.98
Dubrovnik|Croatia|Europe/Zagreb|42.65|18.09
Split|Croatia|Europe/Zagreb|43.51|16.44
Kotor|Montenegro|Europe/Podgorica|42.42|18.77
Belgrade|Serbia|Europe/Belgrade|44.79|20.45
Sarajevo|Bosnia and Herzegovina|Europe/Sarajevo|43.86|18.41
Bucharest|Romania|Europe/Bucharest|44.43|26.1
Sofia|Bulgaria|Europe/Sofia|42.7|23.32
Athens|Greece|Europe/Athens|37.98|23.73
Santorini|Greece|Europe/Athens|36.39|25.46
Mykonos|Greece|Europe/Athens|37.45|25.33
Crete|Greece|Europe/Athens|35.24|24.81
Thessaloniki|Greece|Europe/Athens|40.64|22.94
Corfu|Greece|Europe/Athens|39.62|19.92
Valletta|Malta|Europe/Malta|35.9|14.51
Nicosia|Cyprus|Asia/Nicosia|35.19|33.38
Cappadocia|Turkey|Europe/Istanbul|38.64|34.83
Antalya|Turkey|Europe/Istanbul|36.9|30.71
Kyiv|Ukraine|Europe/Kyiv|50.45|30.52
Moscow|Russia|Europe/Moscow|55.76|37.62
Saint Petersburg|Russia|Europe/Moscow|59.93|30.34
Marrakech|Morocco|Africa/Casablanca|31.63|-7.99
Casablanca|Morocco|Africa/Casablanca|33.57|-7.59
Fes|Morocco|Africa/Casablanca|34.03|-5
Chefchaouen|Morocco|Africa/Casablanca|35.17|-5.26
Cairo|Egypt|Africa/Cairo|30.04|31.24
Luxor|Egypt|Africa/Cairo|25.69|32.64
Tunis|Tunisia|Africa/Tunis|36.81|10.18
Cape Town|South Africa|Africa/Johannesburg|-33.92|18.42
Johannesburg|South Africa|Africa/Johannesburg|-26.2|28.05
Nairobi|Kenya|Africa/Nairobi|-1.29|36.82
Zanzibar|Tanzania|Africa/Dar_es_Salaam|-6.17|39.2
Kigali|Rwanda|Africa/Kigali|-1.94|30.06
Victoria Falls|Zimbabwe|Africa/Harare|-17.93|25.83
Accra|Ghana|Africa/Accra|5.6|-0.19
Lagos|Nigeria|Africa/Lagos|6.52|3.38
Dakar|Senegal|Africa/Dakar|14.72|-17.47
Addis Ababa|Ethiopia|Africa/Addis_Ababa|9.03|38.74
Mauritius|Mauritius|Indian/Mauritius|-20.35|57.55
Seychelles|Seychelles|Indian/Mahe|-4.68|55.49
`

const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export const CITIES = DATA.trim()
  .split('\n')
  .map((line) => {
    const [city, country, timeZone, lat, lng] = line.split('|')
    const label = `${city}, ${country}`
    return { city, country, label, timeZone, lat: Number(lat), lng: Number(lng), key: strip(label) }
  })

// Up to `limit` cities for what has been typed so far. A city whose name
// starts with it comes first, then any word of the city or country that does.
export function suggest(query, limit = 6) {
  const q = strip(query.trim())
  if (!q) return []
  const first = []
  const rest = []
  for (const c of CITIES) {
    if (c.key.startsWith(q)) first.push(c)
    else if (c.key.split(/[\s,.'-]+/).some((w) => w.startsWith(q))) rest.push(c)
    else if (q.length > 3 && c.key.includes(q)) rest.push(c)
    if (first.length >= limit) break
  }
  return first.concat(rest).slice(0, limit)
}

// The entry a typed label names exactly, if any.
export const findCity = (label) => CITIES.find((c) => c.key === strip(label.trim())) ?? null

// The continent a place is on, from its time zone (and, in the Americas,
// which side of Panama it lies).
export function continentOf(timeZone, lat, lng) {
  const region = timeZone.split('/')[0]
  if (region === 'America') return lat < 12.5 && lng > -79.1 ? 'South America' : 'North America'
  if (region === 'Australia' || region === 'Pacific') return 'Oceania'
  if (region === 'Atlantic') return 'Europe'
  if (region === 'Indian') return timeZone === 'Indian/Maldives' ? 'Asia' : 'Africa'
  return region // Europe, Asia, Africa
}
