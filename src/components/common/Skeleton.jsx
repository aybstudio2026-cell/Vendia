import React from 'react';

export default function Skeleton() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      {/* Top Banner Skeleton */}
      <div
        className="skel"
        style={{
          height: '32px',
          borderRadius: 0,
          background: 'var(--carbon)',
          opacity: 0.8
        }}
      />

      <div className="app">
        {/* Sidebar Skeleton */}
        <nav style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="skel" style={{ width: '130px', height: '24px', marginBottom: '16px' }} />
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="skel"
              style={{
                width: '100%',
                height: '38px',
                borderRadius: '8px',
                opacity: 0.6
              }}
            />
          ))}
        </nav>

        {/* Main Content Skeleton */}
        <div className="main">
          {/* Header Skeleton */}
          <div className="top" style={{ marginBottom: '32px' }}>
            <div style={{ display: 'grid', gap: '8px' }}>
              <div className="skel" style={{ width: '220px', height: '28px' }} />
              <div className="skel" style={{ width: '150px', height: '16px', opacity: 0.6 }} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div className="skel" style={{ width: '70px', height: '36px', borderRadius: '12px' }} />
              <div className="skel" style={{ width: '100px', height: '36px', borderRadius: '12px' }} />
              <div className="skel" style={{ width: '80px', height: '36px', borderRadius: '12px' }} />
            </div>
          </div>

          {/* Section Bar Skeleton */}
          <div className="bar" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'grid', gap: '8px' }}>
              <div className="skel" style={{ width: '180px', height: '36px' }} />
              <div className="skel" style={{ width: '260px', height: '18px', opacity: 0.6 }} />
            </div>
          </div>

          {/* 4 KPI Cards Skeleton */}
          <div className="sec stats">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="stat" style={{ padding: '24px' }}>
                <div className="skel" style={{ width: '90px', height: '32px', marginBottom: '8px' }} />
                <div className="skel" style={{ width: '120px', height: '14px', opacity: 0.6 }} />
              </div>
            ))}
          </div>

          {/* 2 Big Cards Skeleton */}
          <div className="sec two w">
            <div className="card" style={{ height: '240px', padding: '24px' }}>
              <div className="skel" style={{ width: '200px', height: '20px', marginBottom: '24px' }} />
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '140px' }}>
                {[40, 70, 55, 90, 60, 80, 100].map((h, idx) => (
                  <div
                    key={idx}
                    className="skel"
                    style={{ flex: 1, height: `${h}%`, borderRadius: '6px 6px 0 0' }}
                  />
                ))}
              </div>
            </div>

            <div className="card" style={{ height: '240px', padding: '24px' }}>
              <div className="skel" style={{ width: '160px', height: '20px', marginBottom: '24px' }} />
              <div style={{ display: 'grid', gap: '16px' }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ display: 'grid', gap: '6px' }}>
                    <div className="skel" style={{ width: '100%', height: '14px' }} />
                    <div className="skel" style={{ width: '100%', height: '8px', borderRadius: '99px' }} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Table / List Skeleton */}
          <div className="card" style={{ padding: '20px' }}>
            <div className="skel" style={{ width: '180px', height: '20px', marginBottom: '16px' }} />
            <div style={{ display: 'grid', gap: '12px' }}>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="skel"
                  style={{
                    width: '100%',
                    height: '48px',
                    borderRadius: '8px',
                    opacity: 0.5
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
