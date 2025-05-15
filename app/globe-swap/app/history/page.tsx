export default function History() {
    const transactions = [
      {
        id: 1,
        date: "Apr 25, 2025",
        counterparty: "Apex",
        sent: "95 SOL",
        received: "10,000 USDC",
        status: "Completed"
      },
      {
        id: 2,
        date: "Apr 22, 2025",
        counterparty: "DK",
        sent: "250 SOL",
        received: "DeGods #1337 NFT",
        status: "Completed"
      }
    ]
  
    return (
      <div className="max-w-2xl mx-auto p-4">
        <h1 className="text-2xl font-bold">Transaction History</h1>
        <p>The trades/swaps you successfully executed 🎉</p>
        <br />
        <div className="space-y-6">
          {transactions.map(tx => (
            <div key={tx.id} className="bg-gray-800 p-4 rounded-lg">
              <p className="text-gray-400 text-sm">{tx.date}</p>
              <h2 className="font-semibold mt-1">{tx.counterparty}</h2>
              <div className="my-2">
                <p>You Sent: {tx.sent}</p>
                <p>You Received: {tx.received}</p>
              </div>
              <p className="text-green-400 text-sm">{tx.status}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }