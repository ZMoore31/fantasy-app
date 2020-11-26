import React, { useState, useEffect } from "react";
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
  for (let i = 0; i <= 200; i += 0.5) {
    data.push({name: i, away: normal[0].pdf(i), home: normal[1].pdf(i)})
  }
  console.log(data)
  return(data)
}

function App() {
  const [currentWeek, updateCurrentWeek] = useState(null);
  const [currentWeekSchedule, updateCurrentSchedule] = useState([]);
  const [league, updateLeague] = useState("78513283");
  const [year, updateYear] = useState(2020);
  const [teams, updateTeams] = useState([]);
  const [schedule, updateSchedule] = useState([]);
  const [selectedMatchup, updateMatchup] = useState(null)
  const [away, updateAway] = useState({})
  const [home, updateHome] = useState({})
  const [awayNormDist, updateAwayNormDist] = useState(null)
  const [homeNormDist, updateHomeNormDist] = useState(null)
  const [normDist, updateNormDist] = useState(null)
  const [awayRandom, updateAwayRandom] = useState(Math.random())
  const [homeRandom, updateHomeRandom] = useState(Math.random())
  const [graphData, updateGraphData] = useState([])

  const refresh = () => {
    updateAwayRandom(Math.random())
    updateHomeRandom(Math.random())
  }

  useEffect(() => {
    axios
      .get(
        `https://fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${league}`
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
        const dataHome = res.data.schedule.map(obj => {
          return {
            id: obj.id,
            week: obj.matchupPeriodId,
            teamId: obj.home.teamId,
            totalPoints: obj.home.totalPoints
          };
        });
        const dataAway = res.data.schedule.map(obj => {
          return {
            id: obj.id,
            week: obj.matchupPeriodId,
            teamId: obj.away.teamId,
            totalPoints: obj.away.totalPoints
          };
        });
        const data = dataHome.concat(dataAway);
        updateSchedule(
          data
            .sort((a, b) => {
              return a.week - b.week;
            })
            .filter(obj => {
              return obj.week < currentWeek;
            })
        );
        const currentSched = res.data.schedule.filter(obj => {
          return obj.matchupPeriodId === currentWeek
        })
        updateCurrentSchedule(
          currentSched
        );
        if (currentSched.length > 0) {
          updateMatchup(
            currentSched[0].id
          )
        }
      });
  }, [league, year, currentWeek]);

  useEffect(() => {
    const updatedTeams = teams.map(obj => {
      const stats = getStats(
        schedule
          .filter(obj2 => {
            return obj2.teamId === obj.id;
          })
          .map(obj3 => obj3.totalPoints)
      )

      return { ...obj, average: stats.average, variance: stats.variance }
    })
    updateTeams(updatedTeams)
  }, [schedule])

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
        const newGraphData = generateNormalData([newAwayNormDist, newHomeNormDist])
        updateGraphData(newGraphData)
      }
    } catch (error) {
      console.log(error)
    }
  }, [selectedMatchup, currentWeekSchedule, teams])

  if (teams.length === 0 || schedule.length === 0 || !selectedMatchup) {
    return <div>loading...</div>
  }

  return (
    <div>
      {/* {teams.map(obj => (
        <div style={{ display: 'flex', flexDirection: 'row' }}>
          <div>
            <span>{obj.id} </span>
            <span>{obj.location} </span>
            <span>{obj.nickname}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'row' }}>
            {schedule
              .filter(obj2 => {
                return obj2.teamId === obj.id;
              })
              .map(obj3 => (
                <div>
                  <div>{obj3.totalPoints}</div>
                </div>
              ))}
          </div>
          <div>
            {obj.average}
          </div>
          <div>
            {Math.sqrt(obj.variance)}
          </div>
        </div>
      ))} */}

      <div className='matchUpHeader'>
        <div>{away.location} {away.nickname} {normDist ? `(${(normDist.cdf(0) * 100).toFixed(2)}%)` : null} vs {home.location} {home.nickname} {normDist ? `(${((1 - normDist.cdf(0)) * 100).toFixed(2)}%)` : null}</div>
        <select name="matchUp" value={selectedMatchup} onChange={event => updateMatchup(event.target.value)}>
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
      {/* {awayNormDist? <div>{JSON.stringify(awayNormDist.ppf(awayRandom))}</div> : null}
      {homeNormDist? <div>{JSON.stringify(homeNormDist.ppf(homeRandom))}</div> : null}
      <button onClick={refresh}>Refresh</button> */}
      <ResponsiveContainer width="100%" height={500}>
      <LineChart
        data={graphData}
        margin={{
          top: 24, right: 56, left: 40, bottom: 8,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis tickFormatter={formatYAxis}/>
        <Legend />
        <Line type="monotone" dataKey="away" stroke="blue" name={`${away.location} ${away.nickname}`} dot={false} />
        <Line type="monotone" dataKey="home" stroke="red" name={`${home.location} ${home.nickname}`} dot={false} />
      </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const formatYAxis = (tickItem) => {
  return `${(tickItem * 100).toFixed(2)}%`
  }

export default App;
