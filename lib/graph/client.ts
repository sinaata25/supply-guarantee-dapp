const GRAPH_URL = "YOUR_ENDPOINT_HERE";

export async function fetchMyOrders(address: string) {
  const query = `
    {
      orderParticipants(where: { participant: "${address.toLowerCase()}" }) {
        role
        order {
          id
          stage
          token
          price
          buyer
          seller
          createdAt
        }
      }
    }
  `;

  const res = await fetch(GRAPH_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
  });

  const json = await res.json();
  return json.data.orderParticipants;
}
