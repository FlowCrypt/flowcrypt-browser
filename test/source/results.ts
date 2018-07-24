
interface Results {
  success: string[];
  error: string[];
  start: number;
}

export let results: Results = {success: [], error: [], start: Date.now()};

export function print_results() {
  let time = `in ${Math.round((Date.now() - results.start) / (1000 * 60))}m`;
  if(results.error.length) {
    console.log(`failed:${results.error.length} ${time}`);
  } else {
    console.log(`success ${time}`);
  }
}
