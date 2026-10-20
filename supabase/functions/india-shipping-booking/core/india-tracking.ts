/** Only timezone-qualified timestamps may drive tracking projection.
 * Unqualified provider times remain in event history until their account format is certified.
 */
export function indiaTrackingTimestamp(value:unknown,now=Date.now()):string|null {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value))return null;
 if(Number(value.slice(11,13))>23||Number(value.slice(14,16))>59||Number(value.slice(17,19))>59)return null;
 const time=Date.parse(value);
 if(!Number.isFinite(time)||time>now+300000||time<Date.UTC(2000,0,1))return null;
 // Reject calendar overflow (e.g. February 30) rather than letting Date normalize it.
 const day=value.slice(0,10), [year,month,date]=day.split('-').map(Number);
 if(new Date(Date.UTC(year,month-1,date)).toISOString().slice(0,10)!==day)return null;
 return new Date(time).toISOString();
}
