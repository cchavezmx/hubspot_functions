require('dotenv').config();
const express = require('express')
const app = express()
const PORT = 3000
const axios = require('axios');

const hubspot = require('@hubspot/api-client');
const hubspotClient = new hubspot.Client({ apiKey: process.env.HUBSPOT_API_KEY });

// PARA BUSCAR EN EL PIEPLELINE ESPECIFICO
// stage => Becalos
const PIPELINE_ID = '1528677';

// PARA MOVER EL DEAL DE STAGE
// stage => INSCRITO
const STAGE_PIPILNE = 5402703


// busca dentro del pipeline espcifico
const getOnePipeLine = async (value) => {
  try {
      const PublicObjectSearchRequest = { filterGroups: [
        { filters: [
        { value, propertyName: 'hs_object_id', operator: 'EQ' },
        { value: PIPELINE_ID, propertyName: 'pipeline', operator: 'EQ' }
        ]}
      ]};
      const apirResponse = await hubspotClient
        .crm
        .deals
        .searchApi
        .doSearch(PublicObjectSearchRequest);
        // TODO CUANDO NO HAY COINCIDENCIAS
      if (apirResponse.body.results.length === 0) throw new Error('No existe el deal')
      return apirResponse.body.results[0].id;
  }catch(error){
    return null
  }
}

const getIdAssociation = async id => axios.get(`https://api.hubapi.com/crm-associations/v1/associations/${id}/HUBSPOT_DEFINED/4?hapikey=${process.env.HUBSPOT_API_KEY}`)
  .then(async({ data }) => {
    
    // return data.results[0]
    if (data.results.length === 1){      
      return data.results[0]

    } else {
      console.log(data.results, 'allDealsIds')
      const allDealsIds = data.results
      const promisseDeals = allDealsIds.map(async (deal) => await getOnePipeLine(deal))

      return await Promise.all(promisseDeals)
      .then(res => {
        console.log(res, 'res')
        const dealPromise = res.find(deal => deal !== null)
        return dealPromise
      })
      
    }

  });

const findDeal = async (id) => {
  try {
    return await Promise.resolve(
      getIdAssociation(id),
    ).then(async (value) => {
      console.log(value, 'value')
      if (value === null) throw new Error('No existe el deal')

      const PublicObjectSearchRequest = { filterGroups: [
        { filters: [{ value, propertyName: 'hs_object_id', operator: 'EQ' }]}
      ]};
      const apirResponse = await hubspotClient
        .crm
        .deals
        .searchApi
        .doSearch(PublicObjectSearchRequest);
      console.log(apirResponse.body.results, 'dentro del deal')
      return apirResponse.body.results[0].id;
    });
  } catch (error) {
    return error;
  }
};

const findContactEmail = async (email) => {
  
  const PublicObjectSearchRequest = { filterGroups: [{ filters: [{ value: email, propertyName: 'email', operator: 'EQ' }] }] };
  try {
    const apiResponse = await hubspotClient
      .crm
      .contacts
      .searchApi
      .doSearch(PublicObjectSearchRequest);

    return apiResponse.body.results[0].id;
  } catch (error) {
    throw new Error(error);
  }
};

// PARA ACTUALIZAR EL DEAL
const moveStageToDeal = async (id) => {
  console.log(id, 'id para mover')
  const properties = {
    dealstage: STAGE_PIPILNE,
  };

  const SimplePublicObjectInput = { properties };
  const dealId = `${id}`;

  try {
    const apiResponse = await
    hubspotClient
      .crm
      .deals
      .basicApi
      .update(dealId, SimplePublicObjectInput);
    return apiResponse;
  } catch (error) {
    return error;
  }
};

app.post('/find-deal', async (req, res) => {
    try {
      const email = 'carlos@devf.mx'
      const dealId = await findContactEmail(email);

      const deal = await findDeal(dealId); 
          // TODO MOVER STAGE

      const changeStage = await moveStageToDeal(deal);

      return res.status(200).json({ success: JSON.stringify(changeStage.response.statusCode) });
      

    }catch (error) {
      return res.status(500).send(error);
    }
})


app.listen(PORT, () => console.log(`Example app listening on port ${PORT}!`))