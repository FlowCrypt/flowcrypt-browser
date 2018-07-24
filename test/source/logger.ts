
interface Results {
  success: string[];
  error: string[];
  start: number;
}

export let results: Results = {success: [], error: [], start: Date.now()};

export let print_results = () => {
  let time = `in ${Math.round((Date.now() - results.start) / (1000 * 60))}m`;
  if(results.error.length) {
    console.log(`failed:${results.error.length} ${time}`);
  } else {
    console.log(`success ${time}`);
  }
};

export let log_test_step = (text: string, error?: string|undefined) => {
  if(!error) {
    console.log(`[ok] ${text}`);
    results.success.push(text);
  } else {
    console.error(`[error] ${text} (${String(error)})`);
    results.error.push(`${text}|${String(error)}`);
  }
};
