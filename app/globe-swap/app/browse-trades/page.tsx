export default function BrowseTrades() {
    const trades = [
      {
        id: 1,
        trader: "Bob",
        offering: "50 SOL",
        requesting: "5,000 USDC",
        expires: "25h 45m"
      },
      {
        id: 2,
        trader: "Apex",
        offering: "10,000 USDC",
        requesting: "95 SOL",
        expires: "12h 30m"
      },
      {
        id: 3,
        trader: "DK",
        offering: "DeGods #1337 NFT",
        requesting: "250 SOL",
        expires: "47h 15m"
      }
    ]
  
    return (
      <div className="max-w-2xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Browse Trades</h1>
        
        <div className="space-y-4">
          {trades.map(trade => (
            <div key={trade.id} className="bg-gray-800 p-4 rounded-lg">
              <h2 className="font-semibold">{trade.trader}</h2>
              <div className="my-2">
                <p>Offering: {trade.offering}</p>
                <p>Requesting: {trade.requesting}</p>
              </div>
              <p className="text-sm text-gray-400">Expires in {trade.expires}</p>
              <button className="mt-2 bg-purple-600 hover:bg-purple-700 px-4 py-1 rounded">
                View Details
              </button>
            </div>
          ))}
        </div>
      </div>
    )
  }