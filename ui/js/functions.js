window.onload = async function main() {
  const configRes = await fetch("/api/config");
  const config = await configRes.json();
  console.log(config);
};
