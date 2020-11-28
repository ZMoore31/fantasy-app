import React, { useState, useEffect, Fragment } from "react";
import axios from "axios";
import NormalDistribution from 'gaussian';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

import './App.css';

const limitList = (data, limit = null) => {
  let temp;
  if (limit < data.length) {
    temp = data.slice(-limit);
  } else {
    temp = data;
  }
  return temp;
};

const avg = (data, limit = null) => {
  const tempData = limitList(data, limit);
  const sum = tempData.reduce((a, b) => {
    return a + b;
  }, 0);
  return sum / tempData.length;
};

const getStats = (data, limit = null) => {
  const tempData = limitList(data, limit);
  const average = avg(tempData);
  const squareDiffs = tempData.map(value => (value - average) ** 2);
  return { average: average, variance: avg(squareDiffs) };
};

const getItem = (list, matchValue, matchField) => {
  const index = list.map(temp => temp[matchField]).indexOf(matchValue)
  return list[index]
}

const generateNormalData = (normal) => {
  let data = []
  for (let i = 0; i <= 200; i++) {
    data.push({ name: i, away: normal[0].pdf(i), home: normal[1].pdf(i), diff: normal[2].pdf(i - 100) })
  }
  return (data)
}

const generateSimulationScores = (teams, futureSchedule) => {
  return futureSchedule.map(obj => {
    const awayTeam = getItem(teams, obj.away.teamId, 'id')
    const awayDist = NormalDistribution(awayTeam.average, awayTeam.variance)
    const homeTeam = getItem(teams, obj.home.teamId, 'id')
    const homeDist = NormalDistribution(homeTeam.average, homeTeam.variance)
    obj.away.totalPoints = awayDist.ppf(Math.random())
    obj.home.totalPoints = homeDist.ppf(Math.random())
    let winner
    if (obj.away.totalPoints > obj.home.totalPoints) {
      winner = 'AWAY'
    } else {
      winner = 'HOME'
    }
    obj.winner = winner
    return obj
  })
}

const calcPlayoffRankings = (teams) => {
  if (teams.length !== 0) {
    const division1Winner = teams.filter(obj => obj.divisionId === 0).sort((a, b) => {
      if (b.record.calculated.wins - a.record.calculated.wins === 0) {
        return b.record.calculated.pointsFor - a.record.calculated.pointsFor
      }
      return b.record.calculated.wins - a.record.calculated.wins
    })[0]
    const division2Winner = teams.filter(obj => obj.divisionId === 1).sort((a, b) => {
      if (b.record.calculated.wins - a.record.calculated.wins === 0) {
        return b.record.calculated.pointsFor - a.record.calculated.pointsFor
      }
      return b.record.calculated.wins - a.record.calculated.wins
    })[0]
    const divisionWinners = [division1Winner, division2Winner].sort((a, b) => {
      if (b.record.calculated.wins - a.record.calculated.wins === 0) {
        return b.record.calculated.pointsFor - a.record.calculated.pointsFor
      }
      return b.record.calculated.wins - a.record.calculated.wins
    })
    const nonWinners = teams.filter(obj => {
      return !divisionWinners.includes(obj)
    }).sort((a, b) => {
      if (b.record.calculated.wins - a.record.calculated.wins === 0) {
        return b.record.calculated.pointsFor - a.record.calculated.pointsFor
      }
      return b.record.calculated.wins - a.record.calculated.wins
    })
    let playoffRankings = [...divisionWinners, ...nonWinners]
    playoffRankings = playoffRankings.map((obj, index) => {
      obj.playoffSeed = index + 1;
      return obj;
    })
    return playoffRankings.sort((a, b) => {
      return a.playoffSeed - b.playoffSeed
    });
  }
  return []
}

const calcRecords = (results, teams) => {
  let data = teams.map(obj => {
    return { ...obj, record: { ...obj.record, calculated: { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 } } }
  })
  const indexes = teams.reduce((map, obj, ind) => {
    map[obj.id] = ind
    return map
  }, {})
  for (let x in results) {
    const game = results[x]
    if (game.winner === "AWAY") {
      data[indexes[game.away.teamId]].record.calculated.wins += 1
      data[indexes[game.home.teamId]].record.calculated.losses += 1
    } else {
      data[indexes[game.home.teamId]].record.calculated.wins += 1
      data[indexes[game.away.teamId]].record.calculated.losses += 1
    }
    data[indexes[game.home.teamId]].record.calculated.pointsFor += game.home.totalPoints
    data[indexes[game.home.teamId]].record.calculated.pointsAgainst += game.away.totalPoints
    data[indexes[game.away.teamId]].record.calculated.pointsFor += game.away.totalPoints
    data[indexes[game.away.teamId]].record.calculated.pointsAgainst += game.home.totalPoints
  }
  data = calcPlayoffRankings(data)
  return data
}

function App() {
  const [currentWeek, updateCurrentWeek] = useState(null);
  const [currentWeekSchedule, updateCurrentSchedule] = useState([]);
  const [league, updateLeague] = useState("78513283");
  const [year, updateYear] = useState(2020);
  const [teams, updateTeams] = useState([]);
  const [futureSchedule, updateFutureSchedule] = useState([]);
  const [pastSchedule, updatePastSchedule] = useState([]);
  const [selectedMatchup, updateMatchup] = useState(null)
  const [away, updateAway] = useState({})
  const [home, updateHome] = useState({})
  const [awayNormDist, updateAwayNormDist] = useState(null)
  const [homeNormDist, updateHomeNormDist] = useState(null)
  const [normDist, updateNormDist] = useState(null)
  const [awayRandom, updateAwayRandom] = useState(Math.random())
  const [homeRandom, updateHomeRandom] = useState(Math.random())
  const [graphData, updateGraphData] = useState([])
  const [simulatedData, updateSimulation] = useState([])
  const [numberOfSims, updateNumberOfSims] = useState(10000)
  const [weeksForProj, updateWeeksForPro] = useState(5)

  const refresh = () => {
    updateAwayRandom(Math.random())
    updateHomeRandom(Math.random())
  }

  const simulation = () => {
    let results = []
    let data = []
    for (let i = 1; i <= numberOfSims; i++) {
      const future = generateSimulationScores(teams, futureSchedule)
      const sim = calcRecords([...pastSchedule, ...future], teams)
      results.push([...pastSchedule, ...future])
      data.push(sim)
    }
    let aggData = teams.map(obj => {
      return { ...obj, playoffSeed: 0, playoffMatrix: {}, record: { ...obj.record, calculated: { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 } } }
    })
    const aggIndexes = teams.reduce((map, obj, ind) => {
      map[obj.id] = ind
      return map
    }, {})
    for (let x in data) {
      const indexes = data[x].reduce((map, obj, ind) => {
        map[obj.id] = ind
        return map
      }, {})
      for (let y in data[x]) {
        aggData[aggIndexes[data[x][y].id]].playoffSeed += data[x][indexes[data[x][y].id]].playoffSeed / numberOfSims
        aggData[aggIndexes[data[x][y].id]].playoffMatrix[data[x][indexes[data[x][y].id]].playoffSeed] = (aggData[aggIndexes[data[x][y].id]].playoffMatrix[data[x][indexes[data[x][y].id]].playoffSeed] || 0) + 1 / numberOfSims;
        aggData[aggIndexes[data[x][y].id]].record.calculated.wins += data[x][indexes[data[x][y].id]].record.calculated.wins / numberOfSims
        aggData[aggIndexes[data[x][y].id]].record.calculated.losses += data[x][indexes[data[x][y].id]].record.calculated.losses / numberOfSims
        aggData[aggIndexes[data[x][y].id]].record.calculated.pointsFor += data[x][indexes[data[x][y].id]].record.calculated.pointsFor / numberOfSims
        aggData[aggIndexes[data[x][y].id]].record.calculated.pointsAgainst += data[x][indexes[data[x][y].id]].record.calculated.pointsAgainst / numberOfSims
      }
    }
    console.log(aggData)
    updateSimulation(aggData.sort((a, b) => {
      return a.playoffSeed - b.playoffSeed
    }))
  }

  useEffect(() => {
    axios
      .get(
        `https://fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${league}?view=mTeam`
      )
      .then(res => {
        updateCurrentWeek(Number(res.data.scoringPeriodId));
        updateTeams(res.data.teams);
      });
  }, [league, year]);

  useEffect(() => {
    axios
      .get(
        `https://fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${league}?view=mMatchup&view=mMatchupScore`
      )
      .then(res => {
        const currentSched = res.data.schedule.filter(obj => {
          return obj.matchupPeriodId === currentWeek
        })
        updateCurrentSchedule(
          currentSched
        );
        updateFutureSchedule(res.data.schedule.filter(obj => {
          return obj.matchupPeriodId >= currentWeek
        }))
        updatePastSchedule(res.data.schedule.filter(obj => {
          return obj.matchupPeriodId < currentWeek
        }))
        if (currentSched.length > 0) {
          updateMatchup(
            currentSched[0].id
          )
        }
      });
  }, [league, year, currentWeek]);

  useEffect(() => {
    const dataHome = pastSchedule.map(obj => {
      return {
        id: obj.id,
        week: obj.matchupPeriodId,
        teamId: obj.home.teamId,
        totalPoints: obj.home.totalPoints
      };
    });
    const dataAway = pastSchedule.map(obj => {
      return {
        id: obj.id,
        week: obj.matchupPeriodId,
        teamId: obj.away.teamId,
        totalPoints: obj.away.totalPoints
      };
    });
    const data = dataHome.concat(dataAway);
    const updatedTeams = teams.map(obj => {
      const stats = getStats(
        data.sort((a, b) => {
          return a.week - b.week;
        })
          .filter(obj2 => {
            return obj2.teamId === obj.id;
          })
          .map(obj3 => obj3.totalPoints), weeksForProj
      )

      return { ...obj, average: stats.average, variance: stats.variance }
    })
    const calcedTeams = calcRecords(pastSchedule, updatedTeams)
    updateTeams(calcedTeams)
  }, [pastSchedule])

  useEffect(() => {
    try {
      const tempAway = getItem(teams, getItem(currentWeekSchedule, Number(selectedMatchup), 'id').away.teamId, 'id')
      updateAway(tempAway)
      const tempHome = getItem(teams, getItem(currentWeekSchedule, Number(selectedMatchup), 'id').home.teamId, 'id')
      updateHome(tempHome)
      if (tempHome.average && tempAway.average) {
        const newAwayNormDist = NormalDistribution(tempAway.average, tempAway.variance);
        updateAwayNormDist(newAwayNormDist)
        const newHomeNormDist = NormalDistribution(tempHome.average, tempHome.variance);
        updateHomeNormDist(newHomeNormDist)
        const newNormDist = NormalDistribution(tempHome.average - tempAway.average, tempHome.variance + tempAway.variance);
        updateNormDist(newNormDist)
        const newGraphData = generateNormalData([newAwayNormDist, newHomeNormDist, newNormDist])
        updateGraphData(newGraphData)
      }
    } catch (error) {
      console.log(error)
    }
  }, [selectedMatchup, currentWeekSchedule, teams])

  if (teams.length === 0) {
    return <div>Getting team data...</div>
  }

  if (pastSchedule.length === 0) {
    return <div>Getting historical data...</div>
  }

  if (!selectedMatchup) {
    return <div>Getting matchup data...</div>
  }

  if (!teams[0].record.calculated) {
    return <div>Calculating...</div>
  }

  return (
    <div>
      <div className='row centerRow'>
        <select name="matchUp" className="matchUpSelect" value={selectedMatchup} onChange={event => updateMatchup(event.target.value)}>
          {currentWeekSchedule.map(obj => {
            const awayTeam = getItem(teams, obj.away.teamId, 'id')
            const homeTeam = getItem(teams, obj.home.teamId, 'id')
            if (!homeTeam || !awayTeam) {
              return null
            }
            return <option value={obj.id}>{awayTeam.location} {awayTeam.nickname} vs {homeTeam.location} {homeTeam.nickname}</option>
          })}
        </select>
      </div>
      <div className='row fullWidth spaceEvenly'>
        <div className='table'>
          {away.average && away.variance && home.average && home.variance && <div className='row'>
            <div className='col'>
              <div className='row row-header'><div className='nameCell'>Team Name</div></div>
              <div className='nameCell'>{away.location} {away.nickname}</div>
              <div className='nameCell'>{home.location} {home.nickname}</div>
            </div>
            <div className='col valueCells'>
              <div className='row row-header'><div className='valueCell'>Proj Points</div><div className='valueCell'>Standard Deviation</div><div className='valueCell'>Win %</div></div>
              <div className='row'><div className='valueCell'>{away.average.toFixed(2)}</div><div className='valueCell'>{Math.sqrt(away.variance).toFixed(2)}</div><div className='valueCell'>{(normDist.cdf(0) * 100).toFixed(2)}%</div></div>
              <div className='row'><div className='valueCell'>{home.average.toFixed(2)}</div><div className='valueCell'>{Math.sqrt(home.variance).toFixed(2)}</div><div className='valueCell'>{((1 - normDist.cdf(0)) * 100).toFixed(2)}%</div></div>
            </div>
          </div>}
        </div>
      </div>
      <div className='row fullWidth spaceEvenly' >
        <div className='graphContainer'>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={graphData}
              margin={{
                top: 24, right: 56, left: 40, bottom: 8,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" type='number' />
              <YAxis tickFormatter={formatYAxis} />
              <Legend />
              <Line type="monotone" strokeWidth={3} dataKey="away" stroke="#CC0014" name={`${away.location} ${away.nickname}`} dot={false} />
              <Line type="monotone" strokeWidth={3} dataKey="home" stroke="#31572c" name={`${home.location} ${home.nickname}`} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className='graphContainer'>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={graphData}
              margin={{
                top: 24, right: 56, left: 40, bottom: 8,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" type='number' tickFormatter={formatDiffXAxis} />
              <YAxis tickFormatter={formatYAxis} />
              <Legend />
              <Line type="monotone" strokeWidth={3} dataKey="diff" stroke="#000" name={`${home.location} ${home.nickname} - ${away.location} ${away.nickname}`} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className='row fullWidth spaceEvenly'>
        <div className='table'>
          <div className='fullWidth header'>Guy's Division</div>
          <div className='row'>
            <div className='col'>
              <div className='row row-header'><div className='nameCell'>Team Name</div></div>
              {teams.filter(obj => obj.divisionId === 0).sort((a, b) => {
                if (b.record.calculated.wins - a.record.calculated.wins === 0) {
                  return b.record.calculated.pointsFor - a.record.calculated.pointsFor
                }
                return b.record.calculated.wins - a.record.calculated.wins
              }).map(obj => {
                return <div className='nameCell'>{obj.location} {obj.nickname}</div>

              })}
            </div>
            <div className='col valueCells'>
              <div className="row row-header"><div className='valueCell'>Wins</div><div className='valueCell'>Losses</div><div className='valueCell'>Points For</div><div className='valueCell'>Points Against</div></div>
              {teams.filter(obj => obj.divisionId === 0).sort((a, b) => {
                if (b.record.calculated.wins - a.record.calculated.wins === 0) {
                  return b.record.calculated.pointsFor - a.record.calculated.pointsFor
                }
                return b.record.calculated.wins - a.record.calculated.wins
              }).map(obj => {
                return <div className="row"><div className='valueCell'>{obj.record.calculated.wins}</div><div className='valueCell'>{obj.record.calculated.losses}</div><div className='valueCell'>{obj.record.calculated.pointsFor.toFixed(2)}</div><div className='valueCell'>{obj.record.calculated.pointsAgainst.toFixed(2)}</div></div>

              })}
            </div>
          </div>
        </div>
        <div className='table'>
          <div className='fullWidth header'>Girl's Division</div>
          <div className='row'>
            <div className='col'>
              <div className='row row-header'><div className='nameCell'>Team Name</div></div>
              {teams.filter(obj => obj.divisionId === 1).sort((a, b) => {
                if (b.record.calculated.wins - a.record.calculated.wins === 0) {
                  return b.record.calculated.pointsFor - a.record.calculated.pointsFor
                }
                return b.record.calculated.wins - a.record.calculated.wins
              }).map(obj => {
                return <div className='nameCell'>{obj.location} {obj.nickname}</div>

              })}
            </div>
            <div className='col valueCells'>
              <div className="row row-header"><div className='valueCell'>Wins</div><div className='valueCell'>Losses</div><div className='valueCell'>Points For</div><div className='valueCell'>Points Against</div></div>
              {teams.filter(obj => obj.divisionId === 1).sort((a, b) => {
                if (b.record.calculated.wins - a.record.calculated.wins === 0) {
                  return b.record.calculated.pointsFor - a.record.calculated.pointsFor
                }
                return b.record.calculated.wins - a.record.calculated.wins
              }).map(obj => {
                return <div className="row"><div className='valueCell'>{obj.record.calculated.wins}</div><div className='valueCell'>{obj.record.calculated.losses}</div><div className='valueCell'>{obj.record.calculated.pointsFor.toFixed(2)}</div><div className='valueCell'>{obj.record.calculated.pointsAgainst.toFixed(2)}</div></div>

              })}
            </div>
          </div>
        </div>
      </div>
      <div className='table'>
        <div className='fullWidth header'>Playoff Rankings</div>
        {teams.map(obj => {
          return <div className='row fullWidth centerRow'><div className='nameCell'>{obj.location} {obj.nickname}</div><div className='valueCell'>{obj.playoffSeed.toFixed(2)}</div></div>
        })}
      </div>
      <div className='row fullWidth centerRow' style={{margin: '24px 0 8px 0'}}><button onClick={simulation}>{simulatedData.length ? "Refresh" : "Run"} Simulation</button></div>
      {simulatedData.length && <Fragment><div className='row fullWidth spaceEvenly'>
        <div className='table'>
          <div className='fullWidth header'>Projected Guy's Division</div>
          <div className='row'>
            <div className='col'>
              <div className='row row-header'><div className='nameCell'>Team Name</div></div>
              {simulatedData.filter(obj => obj.divisionId === 0).sort((a, b) => {
                if (b.record.calculated.wins - a.record.calculated.wins === 0) {
                  return b.record.calculated.pointsFor - a.record.calculated.pointsFor
                }
                return b.record.calculated.wins - a.record.calculated.wins
              }).map(obj => {
                return <div className='nameCell'>{obj.location} {obj.nickname}</div>

              })}
            </div>
            <div className='col valueCells'>
              <div className="row row-header"><div className='valueCell'>Wins</div><div className='valueCell'>Losses</div><div className='valueCell'>Points For</div><div className='valueCell'>Points Against</div></div>
              {simulatedData.filter(obj => obj.divisionId === 0).sort((a, b) => {
                if (b.record.calculated.wins - a.record.calculated.wins === 0) {
                  return b.record.calculated.pointsFor - a.record.calculated.pointsFor
                }
                return b.record.calculated.wins - a.record.calculated.wins
              }).map(obj => {
                return <div className="row"><div className='valueCell'>{obj.record.calculated.wins.toFixed(2)}</div><div className='valueCell'>{obj.record.calculated.losses.toFixed(2)}</div><div className='valueCell'>{obj.record.calculated.pointsFor.toFixed(2)}</div><div className='valueCell'>{obj.record.calculated.pointsAgainst.toFixed(2)}</div></div>

              })}
            </div>
          </div>
        </div>
        <div className='table'>
          <div className='fullWidth header'>Projected Girl's Division</div>
          <div className='row'>
            <div className='col'>
              <div className='row row-header'><div className='nameCell'>Team Name</div></div>
              {simulatedData.filter(obj => obj.divisionId === 1).sort((a, b) => {
                if (b.record.calculated.wins - a.record.calculated.wins === 0) {
                  return b.record.calculated.pointsFor - a.record.calculated.pointsFor
                }
                return b.record.calculated.wins - a.record.calculated.wins
              }).map(obj => {
                return <div className='nameCell'>{obj.location} {obj.nickname}</div>

              })}
            </div>
            <div className='col valueCells'>
              <div className="row row-header"><div className='valueCell'>Wins</div><div className='valueCell'>Losses</div><div className='valueCell'>Points For</div><div className='valueCell'>Points Against</div></div>
              {simulatedData.filter(obj => obj.divisionId === 1).sort((a, b) => {
                if (b.record.calculated.wins - a.record.calculated.wins === 0) {
                  return b.record.calculated.pointsFor - a.record.calculated.pointsFor
                }
                return b.record.calculated.wins - a.record.calculated.wins
              }).map(obj => {
                return <div className="row"><div className='valueCell'>{obj.record.calculated.wins.toFixed(2)}</div><div className='valueCell'>{obj.record.calculated.losses.toFixed(2)}</div><div className='valueCell'>{obj.record.calculated.pointsFor.toFixed(2)}</div><div className='valueCell'>{obj.record.calculated.pointsAgainst.toFixed(2)}</div></div>

              })}
            </div>
          </div>
        </div>
      </div>

        <div className='table'>
          <div className='fullWidth header'>Projected Playoff Rankings</div>
          <div className='row centerRow'>
            <div className='col'>
              <div className='row row-header'><div className='nameCell'>Team Name</div></div>
              {simulatedData.map(obj => {
                return (

                  <div className='nameCell'>{obj.location} {obj.nickname}</div>
                )
              })}
            </div>
            <div className='col valueCells'>
              <div className='row row-header'>
                <div className='valueCell'>Avg Playoff Seed</div>
                <div className='valueCell'>Playoff %</div>
                {simulatedData.map((_, index) => {
                  return <div className='valueCell'>{index + 1}</div>
                })}
              </div>
              {simulatedData.map(obj => {
                return (
                  <div className='row'>
                    <div className='valueCell'>{obj.playoffSeed.toFixed(2)}</div>
                    <div className='valueCell'>{(Object.values(obj.playoffMatrix).reduce((a, b, index) => {
                      if (Object.keys(obj.playoffMatrix)[index] <= 6) {
                        return a + b
                      }
                      return a
                    }, 0) * 100).toFixed(2)}%</div>
                    {simulatedData.map((_, index) => {
                      if (obj.playoffMatrix[index + 1]) {
                        return <div className='valueCell'>{(obj.playoffMatrix[index + 1] * 100).toFixed(2)}%</div>
                      }
                      return <div className='valueCell'>-</div>
                    })}
                  </div>)
              })}
            </div>
          </div>
        </div>
      </Fragment>}
    </div>
  );
}

const formatYAxis = (tickItem) => {
  return `${(tickItem * 100).toFixed(2)}%`
}

const formatDiffXAxis = (tickItem) => {
  return tickItem - 100
}

export default App;
