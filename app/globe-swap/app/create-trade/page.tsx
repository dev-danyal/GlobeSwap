export default function CreateTrade() {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">Create New Trade</h1>
        <p className="mb-8">Set up a secure escrow trade with another party</p>
  
        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">Trade Details</h2>
          
          <div className="mb-6">
            <h3 className="font-medium mb-2">Your Offer</h3>
            <div className="flex gap-4 mb-4">
              <select className="bg-gray-700 p-2 rounded flex-1">
                <option>Select asset</option>
                <option>USDC</option>
                <option>SOL</option>
                <option>NFT</option>
              </select>
              <input 
                type="number" 
                placeholder="Enter amount" 
                className="bg-gray-700 p-2 rounded flex-1"
              />
            </div>
          </div>
  
          <div className="mb-6">
            <h3 className="font-medium mb-2">You Request</h3>
            <div className="flex gap-4">
              <select className="bg-gray-700 p-2 rounded flex-1">
                <option>Select asset</option>
                <option>USDC</option>
                <option>SOL</option>
                <option>NFT</option>
              </select>
              <input 
                type="number" 
                placeholder="Enter amount" 
                className="bg-gray-700 p-2 rounded flex-1"
              />
            </div>
          </div>
  
          <button className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg w-full">
            Deposit to Escrow
          </button>
        </div>
      </div>
    )
  }