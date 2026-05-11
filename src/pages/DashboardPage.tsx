const DashboardPage = () => {
  return (
    <div className="app-content">
      <div className="container-fluid">
        <div className="row g-3">
          <div className="col-lg-4">
            <div className="card">
              <div className="card-header">Users</div>
              <div className="card-body">
                <h4 className="mb-0">1,245</h4>
              </div>
            </div>
          </div>
          <div className="col-lg-4">
            <div className="card">
              <div className="card-header">Sales</div>
              <div className="card-body">
                <h4 className="mb-0">$12,390</h4>
              </div>
            </div>
          </div>
          <div className="col-lg-4">
            <div className="card">
              <div className="card-header">Tickets</div>
              <div className="card-body">
                <h4 className="mb-0">17 Open</h4>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
