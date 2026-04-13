async function test() {
  try {
    const res = await fetch('http://localhost:5000/api/v1/devices');
    const resData = await res.json();
    const device = resData.data[0].name;
    console.log("Device:", device);

    const dataRes = await fetch(`http://localhost:5000/api/v1/data/${device}?limit=100&page=1`);
    const dataResJson = await dataRes.json();
    console.log("Data total params:", dataResJson.data.parameters.length);
    console.log("First param names:", Array.from(new Set(dataResJson.data.parameters.map(p => p.name))));
  } catch (err) {
    console.error(err);
  }
}
test();
